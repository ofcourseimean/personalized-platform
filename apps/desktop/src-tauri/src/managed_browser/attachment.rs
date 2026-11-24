use std::{fs, path::Path};
use serde_json::{Value, json};

// The worker supplies only a generated ID, a validated basename and a byte count.
pub fn verify(root: &Path, envelope: &mut Value) -> Result<(), String> {
    let result = &mut envelope["data"]["attachment"];
    let invalid = "BROWSER_DOWNLOAD_FAILED:";
    let id = result["id"].as_str().ok_or(invalid)?;
    let name = result["name"].as_str().ok_or(invalid)?;
    let bytes = result["bytes"].as_u64().ok_or(invalid)?;
    let directory = root.join("attachments");
    let folder = directory.join(id);
    let file = folder.join(name);
    for path in [&directory, &folder, &file] {
        let metadata = fs::symlink_metadata(path).map_err(|_| invalid)?;
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 { return Err(invalid.into()) }
        }
        if metadata.file_type().is_symlink() { return Err(invalid.into()) }
        if path == &file && (!metadata.is_file() || metadata.len() != bytes) { return Err(invalid.into()) }
    }
    #[cfg(windows)]
    {
        let mut zone = file.as_os_str().to_os_string();
        zone.push(":Zone.Identifier");
        if fs::read_to_string(zone).map_err(|_| invalid)? != "[ZoneTransfer]\r\nZoneId=3\r\n" {
            return Err(invalid.into());
        }
    }
    *result = json!({ "name":name, "bytes":bytes, "path":file, "directory":folder });
    Ok(())
}
