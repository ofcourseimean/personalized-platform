use super::policy::Config;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const SEARCH: &str = "https://search.bilibili.com";
const SPACE: &str = "https://space.bilibili.com";
const INVALID: &str = "BROWSER_RESULT:";

fn valid_uid(uid: &str) -> bool {
    (1..=19).contains(&uid.len()) && !uid.starts_with('0') && uid.bytes().all(|b| b.is_ascii_digit())
}

fn valid_name(name: &str) -> bool {
    (2..=60).contains(&name.chars().count()) && name.trim() == name
        && !name.chars().any(|character| character.is_control() || "<>@".contains(character))
        && !["https:", "http:", "password", "bearer ", "密码", "令牌", "验证码"].iter().any(|word| name.to_lowercase().contains(word))
}

pub fn authorize(config: &Config, name: Option<&str>, uid: Option<&str>) -> Result<(), String> {
    if !config.enabled || !config.sites.iter().any(|site| site == SPACE)
        || (uid.is_none() && !config.sites.iter().any(|site| site == SEARCH)) {
        return Err("BROWSER_SITE_PERMISSION:".into());
    }
    if (name.is_none() && uid.is_none()) || name.is_some_and(|value| !valid_name(value)) || uid.is_some_and(|value| !valid_uid(value)) {
        return Err("BROWSER_ARGUMENT:".into());
    }
    Ok(())
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "status", rename_all = "snake_case", deny_unknown_fields)]
enum Activity {
    Found {
        name: String,
        #[serde(rename = "profileUrl")]
        profile_url: String,
        text: String,
        published: String,
        #[serde(rename = "publishedAt")]
        published_at: u64,
        media: bool,
    },
    Ambiguous {},
    NotFound {},
    Empty {},
    Unavailable {},
    IdentityUnverified {},
    TimeUnverified {},
    LoginRequired {},
}

pub fn validate(name: Option<&str>, uid: Option<&str>, value: Value) -> Result<Value, String> {
    let activity: Activity = serde_json::from_value(value).map_err(|_| INVALID)?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
    if let Activity::Found { name: creator, profile_url, text, published, published_at, media } = &activity {
        let suffix = profile_url.strip_prefix(&format!("{SPACE}/")).and_then(|path| path.strip_suffix("/dynamic"));
        let safe_profile = suffix.is_some_and(valid_uid) && uid.is_none_or(|expected| suffix == Some(expected));
        if !valid_name(creator) || name.is_some_and(|expected| creator != expected) || !safe_profile || text.chars().count() > 800 || published.chars().count() > 64
            || text.contains('\0') || published.chars().any(char::is_control) || published.trim().is_empty()
            || (text.trim().is_empty() && !media) || *published_at == 0 || u128::from(*published_at) > now + 120000
        {
            return Err(INVALID.into());
        }
    }
    Ok(json!({"verified":true,"privateBrowser":true,"untrusted":true,"origin":SPACE,"fetchedAtEpochMs":now,"data":activity}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_both_exact_origins_and_the_user_target() {
        let search_only = Config::new(true, vec![SEARCH.into()], vec![]).unwrap();
        assert!(authorize(&search_only, Some("虚构主播"), None).is_err());
        let space_only = Config::new(true, vec![SPACE.into()], vec![]).unwrap();
        assert!(authorize(&space_only, None, Some("42")).is_ok());
        assert!(authorize(&space_only, None, Some("42/dynamic")).is_err());
        let both = Config::new(true, vec![SEARCH.into(), SPACE.into()], vec![]).unwrap();
        assert!(authorize(&both, Some("虚构主播"), None).is_ok());
        assert!(authorize(&both, Some("https://example.com"), None).is_err());
    }

    #[test]
    fn verifies_type_identity_and_page_location_before_returning_content() {
        let content = json!({"status":"found","name":"虚构主播","profileUrl":"https://space.bilibili.com/42/dynamic","text":"最新发文","published":"刚刚","publishedAt":1,"media":false});
        assert!(validate(Some("虚构主播"), None, content.clone()).is_ok());
        assert!(validate(None, Some("42"), content.clone()).is_ok());
        assert!(validate(None, Some("43"), content.clone()).is_err());
        assert!(validate(Some("其他主播"), None, content.clone()).is_err());
        let mut uncertain = content.clone();
        uncertain["profileUrl"] = json!("https://other.example.com/42/dynamic");
        assert!(validate(Some("虚构主播"), None, uncertain).is_err());
        let mut injected = content;
        injected["cookie"] = json!("not allowed");
        assert!(validate(Some("虚构主播"), None, injected).is_err());
        assert_eq!(validate(Some("虚构主播"), None, json!({"status":"ambiguous"})).unwrap()["data"], json!({"status":"ambiguous"}));
        assert!(validate(Some("虚构主播"), None, json!({"status":"ambiguous","text":"unknown result"})).is_err());
    }
}
