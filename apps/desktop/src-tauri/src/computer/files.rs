use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use super::{policy::target_allowed, types::ComputerPolicy};

const MAX_TEXT_BYTES: u64 = 1_048_576;
const MAX_RESULTS: usize = 200;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub size: u64,
}

fn sensitive(path: &Path) -> bool {
    let value = path.to_string_lossy().replace('/', "\\").to_lowercase();
    ["\\.ssh\\", "\\.aws\\", "\\.gnupg\\", "\\credentials\\", "\\user data\\default\\login data", "\\id_rsa", "\\id_ed25519", "\\.git-credentials"]
        .iter()
        .any(|needle| value.contains(needle))
}

fn absolute(path: &str) -> Result<PathBuf, String> {
    let value = PathBuf::from(path.trim());
    if value.as_os_str().is_empty() || !value.is_absolute() {
        return Err("FILE_PATH_INVALID:必须使用绝对路径".into());
    }
    Ok(value)
}

fn canonical_target(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return path.canonicalize().map_err(|error| format!("FILE_PATH:{error}"));
    }
    let parent = path.parent().ok_or_else(|| "FILE_PATH_INVALID:路径缺少父目录".to_string())?;
    let canonical_parent = parent.canonicalize().map_err(|error| format!("FILE_PARENT:{error}"))?;
    let name = path.file_name().ok_or_else(|| "FILE_PATH_INVALID:路径缺少文件名".to_string())?;
    Ok(canonical_parent.join(name))
}

pub fn guard(policy: &ComputerPolicy, capability: &str, path: &str, confirmed: bool) -> Result<PathBuf, String> {
    let resolved = canonical_target(&absolute(path)?)?;
    if sensitive(&resolved) && !confirmed {
        return Err("FILE_SENSITIVE_CONFIRMATION_REQUIRED:敏感凭据或浏览器资料路径需要明确确认".into());
    }
    if !confirmed && !target_allowed(policy, capability, &resolved.to_string_lossy()) {
        return Err(format!("FILE_SCOPE_DENIED:路径不在已授权范围内：{}", resolved.display()));
    }
    Ok(resolved)
}

fn entry(path: PathBuf) -> Result<FileEntry, String> {
    let metadata = fs::metadata(&path).map_err(|error| format!("FILE_METADATA:{error}"))?;
    Ok(FileEntry {
        name: path.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
        is_directory: metadata.is_dir(),
        size: if metadata.is_file() { metadata.len() } else { 0 },
    })
}

pub fn list(policy: &ComputerPolicy, path: &str, recursive: bool, confirmed: bool) -> Result<Vec<FileEntry>, String> {
    let root = guard(policy, "file_read", path, confirmed)?;
    if !root.is_dir() {
        return Err("FILE_LIST_NOT_DIRECTORY:目标不是目录".into());
    }
    let mut result = Vec::new();
    let mut pending = vec![root];
    while let Some(directory) = pending.pop() {
        for item in fs::read_dir(&directory).map_err(|error| format!("FILE_LIST:{error}"))? {
            let path = item.map_err(|error| format!("FILE_LIST:{error}"))?.path();
            let current = entry(path.clone())?;
            if recursive && current.is_directory {
                pending.push(path);
            }
            result.push(current);
            if result.len() >= MAX_RESULTS {
                return Ok(result);
            }
        }
        if !recursive {
            break;
        }
    }
    Ok(result)
}

pub fn search(policy: &ComputerPolicy, path: &str, query: &str, confirmed: bool) -> Result<Vec<FileEntry>, String> {
    Ok(scan(policy, path, query, false, confirmed)?.entries)
}

#[derive(Serialize)]
pub struct SearchResult {
    pub entries: Vec<FileEntry>,
    pub complete: bool,
}

pub fn scan(policy: &ComputerPolicy, path: &str, query: &str, directories_only: bool, confirmed: bool) -> Result<SearchResult, String> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() || needle.len() > 512 {
        return Err("FILE_SEARCH_INVALID:搜索词不能为空".into());
    }
    let root = guard(policy, "file_read", path, confirmed)?;
    if !root.is_dir() {
        return Err("FILE_LIST_NOT_DIRECTORY:目标不是目录".into());
    }
    let mut entries = Vec::new();
    if directories_only && root.file_name().is_some_and(|name| name.to_string_lossy().to_lowercase().contains(&needle)) {
        let mut folder = entry(root.clone())?;
        folder.path = display_path(&root);
        entries.push(folder);
    }
    let deadline = Instant::now() + Duration::from_secs(2);
    let mut pending = vec![root.clone()];
    let mut visited = 0;
    let mut complete = true;
    while let Some(directory) = pending.pop() {
        let Ok(children) = fs::read_dir(directory) else { complete = false; continue };
        for child in children {
            visited += 1;
            if visited > 20_000 || Instant::now() >= deadline || entries.len() >= MAX_RESULTS {
                return Ok(SearchResult { entries, complete: false });
            }
            let Ok(child) = child else { complete = false; continue };
            let path = child.path();
            let Ok(meta) = fs::symlink_metadata(&path) else { complete = false; continue };
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                // Junctions and other reparse points can leave the authorized tree.
                if meta.file_attributes() & 0x400 != 0 { continue }
            }
            if meta.file_type().is_symlink() || sensitive(&path)
                || (!confirmed && !target_allowed(policy, "file_read", &path.to_string_lossy()))
            { continue }
            if meta.is_dir() {
                let Ok(resolved) = path.canonicalize() else { complete = false; continue };
                if resolved.starts_with(&root) && !sensitive(&resolved)
                    && (confirmed || target_allowed(policy, "file_read", &resolved.to_string_lossy())) {
                    pending.push(resolved);
                } else { continue }
            }
            if (!directories_only || meta.is_dir()) && child.file_name().to_string_lossy().to_lowercase().contains(&needle) {
                entries.push(FileEntry {
                    name: child.file_name().to_string_lossy().into_owned(),
                    path: display_path(&path),
                    is_directory: meta.is_dir(),
                    size: if meta.is_file() { meta.len() } else { 0 },
                });
            }
        }
    }
    Ok(SearchResult { entries, complete })
}

pub fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    if let Some(unc) = value.strip_prefix(r"\\?\UNC\") { return format!(r"\\{unc}") }
    value.strip_prefix(r"\\?\").unwrap_or(&value).to_owned()
}

pub fn read_text(policy: &ComputerPolicy, path: &str, confirmed: bool) -> Result<String, String> {
    let target = guard(policy, "file_read", path, confirmed)?;
    let size = fs::metadata(&target).map_err(|error| format!("FILE_READ:{error}"))?.len();
    if size > MAX_TEXT_BYTES {
        return Err("FILE_TOO_LARGE:文本读取上限为 1 MiB".into());
    }
    fs::read_to_string(target).map_err(|error| format!("FILE_READ_UTF8:{error}"))
}

pub fn write_text(policy: &ComputerPolicy, path: &str, content: &str, confirmed: bool) -> Result<(), String> {
    if content.len() as u64 > MAX_TEXT_BYTES {
        return Err("FILE_TOO_LARGE:单次文本写入上限为 1 MiB".into());
    }
    let target = guard(policy, "file_write", path, confirmed)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("FILE_CREATE_DIR:{error}"))?;
    }
    fs::write(target, content.as_bytes()).map_err(|error| format!("FILE_WRITE:{error}"))
}

pub fn copy(policy: &ComputerPolicy, source: &str, destination: &str, confirmed: bool) -> Result<u64, String> {
    let source = guard(policy, "file_read", source, confirmed)?;
    let destination = guard(policy, "file_write", destination, confirmed)?;
    fs::copy(source, destination).map_err(|error| format!("FILE_COPY:{error}"))
}

pub fn move_file(policy: &ComputerPolicy, source: &str, destination: &str, confirmed: bool) -> Result<(), String> {
    let source = guard(policy, "file_delete", source, confirmed)?;
    let destination = guard(policy, "file_write", destination, confirmed)?;
    fs::rename(source, destination).map_err(|error| format!("FILE_MOVE:{error}"))
}

pub fn delete(policy: &ComputerPolicy, path: &str, confirmed: bool) -> Result<(), String> {
    let target = guard(policy, "file_delete", path, confirmed)?;
    let metadata = fs::metadata(&target).map_err(|error| format!("FILE_DELETE:{error}"))?;
    if metadata.is_dir() {
        fs::remove_dir(target).map_err(|error| format!("FILE_DELETE_DIRECTORY:{error}"))
    } else {
        fs::remove_file(target).map_err(|error| format!("FILE_DELETE:{error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computer::types::ComputerGrant;

    #[test]
    fn searches_past_the_list_limit_and_honors_denied_subtrees() {
        let root = std::env::temp_dir().join(format!("yiyu-folder-{}", std::process::id()));
        fs::create_dir(&root).unwrap();
        let outcome = (|| {
            for index in 0..220 { fs::write(root.join(format!("item-{index:03}")), "test").unwrap(); }
            let hidden = root.join("private");
            fs::create_dir_all(hidden.join("家教")).unwrap();
            fs::create_dir(root.join("家教")).unwrap();
            let policy = ComputerPolicy {
                enabled:true, profile:"custom".into(), ffmpeg_path:String::new(), recording_directory:String::new(),
                grants: [(root.as_path(),"allow"),(hidden.as_path(),"deny")].into_iter().map(|(path, mode)| ComputerGrant {
                    capability:"file_read".into(), target_kind:"directory".into(), target:path.to_string_lossy().into_owned(), mode:mode.into(),
                }).collect(),
            };
            scan(&policy, &root.to_string_lossy(), "家教", true, false)
        })();
        let cleanup = fs::remove_dir_all(&root);
        let result = outcome.unwrap();
        cleanup.unwrap();
        assert!(result.complete);
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].name, "家教");
        assert!(!result.entries[0].path.contains("private"));
    }
}
