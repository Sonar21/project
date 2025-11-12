"use client";
import React, { useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/firebase";

export default function ImageUpload() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleFileChange(e) {
    setError("");
    setUrl("");
    const f = e.target.files && e.target.files[0];
    if (f) {
      if (!f.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      setFile(f);
    }
  }

  function upload() {
    if (!file) return;
    const filename = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `uploads/${filename}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(pct);
      },
      (err) => {
        setError(err.message || "Upload failed");
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setUrl(downloadURL);
        });
      }
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Select an image to upload
      </label>
      <input type="file" accept="image/*" onChange={handleFileChange} />

      <div style={{ marginTop: 12 }}>
        <button onClick={upload} disabled={!file}>
          Upload
        </button>
      </div>

      {progress > 0 && (
        <div style={{ marginTop: 8 }}>Progress: {progress}%</div>
      )}

      {error && (
        <div style={{ color: "red", marginTop: 8 }}>Error: {error}</div>
      )}

      {url && (
        <div style={{ marginTop: 12 }}>
          <div>
            Uploaded URL: <a href={url} target="_blank" rel="noreferrer">{url}</a>
          </div>
          <div style={{ marginTop: 8 }}>
            <img src={url} alt="uploaded" style={{ maxWidth: "100%", height: "auto" }} />
          </div>
        </div>
      )}
    </div>
  );
}
