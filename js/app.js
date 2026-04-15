import {
  initDB,
  getAllDocs,
  getPinnedDocs,
  addDoc,
  togglePin,
  deleteDoc,
} from "./db.js";

const content = document.getElementById("content");
const tabs = document.querySelectorAll(".tabs button");
const searchInput = document.getElementById("searchInput");

let currentTab = "home";
let lastTab = "home";

await initDB();

// Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => console.log("SW registered"));
}

// ----------------------
// SEARCH STATE CONTROL
// ----------------------

function updateSearchState() {
  if (currentTab === "upload") {
    searchInput.disabled = true;
    searchInput.placeholder = "Search disabled in upload";
  } else {
    searchInput.disabled = false;
    searchInput.placeholder = "Search documents...";
  }
}

// ----------------------
// TAB SWITCHING
// ----------------------

tabs.forEach((btn) => {
  btn.onclick = () => {
    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentTab = btn.dataset.tab;

    updateSearchState();
    renderCurrent();
  };
});

// ----------------------
// LIVE SEARCH
// ----------------------

searchInput.oninput = () => {
  if (currentTab === "upload") return;
  renderCurrent();
};

// ----------------------
// MAIN RENDER
// ----------------------

async function renderCurrent() {
  const query = searchInput.value.toLowerCase();

  if (currentTab === "home") {
    let docs = await getPinnedDocs();
    renderDocs(filterDocs(docs, query), true);
  }

  if (currentTab === "library") {
    let docs = await getAllDocs();
    renderDocs(filterDocs(docs, query), false);
  }

  if (currentTab === "upload") {
    loadUpload();
  }
}

async function generatePDFThumbnail(blob) {
  const url = URL.createObjectURL(blob);

  const pdf = await pdfjsLib.getDocument(url).promise;
  const page = await pdf.getPage(1);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const viewport = page.getViewport({ scale: 0.5 });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL(); // image preview
}

// ----------------------
// FILTER
// ----------------------

function filterDocs(docs, query) {
  if (!query) return docs;
  return docs.filter((d) => d.name.toLowerCase().includes(query));
}

// ----------------------
// DOC RENDER
// ----------------------

function renderDocs(docs, isHome) {
  content.innerHTML = `<div class="grid"></div>`;
  const grid = content.querySelector(".grid");

  if (docs.length === 0) {
    grid.innerHTML = "<p>No documents</p>";
    return;
  }

  docs.forEach((doc) => {
    const card = document.createElement("div");
    card.className = "card";

    const url = URL.createObjectURL(doc.blob);
    const isPinned = doc.pinned === true;

    let thumb = `<div class="thumb">📄</div>`;

    // Image preview
    if (doc.blob.type.startsWith("image/")) {
      thumb = `
        <div class="thumb">
          <img src="${url}" />
        </div>
      `;
    }

    // PDF preview
    else if (doc.blob.type === "application/pdf") {
      thumb = `<div class="thumb pdf">Loading...</div>`;

      // async render
      setTimeout(async () => {
        const imgSrc = await generatePDFThumbnail(doc.blob);

        const img = document.createElement("img");
        img.src = imgSrc;

        const thumbDiv = card.querySelector(".thumb");
        if (thumbDiv) {
          thumbDiv.innerHTML = "";
          thumbDiv.appendChild(img);
        }
      }, 0);
    }

    card.innerHTML = `
      ${thumb}
      <div class="card-content">
        <p class="name">${doc.name}</p>
        <div class="actions">
          <button class="open">Open</button>
          <button class="pin">${isPinned ? "Unpin" : "Pin"}</button>
          ${!isHome ? `<button class="delete">Delete</button>` : ""}
        </div>
      </div>
    `;

    // actions
    card.querySelector(".open").onclick = () => openViewer(doc);

    card.querySelector(".pin").onclick = async () => {
      await togglePin(doc.id);
      renderCurrent();
    };

    if (!isHome) {
      card.querySelector(".delete").onclick = async () => {
        await deleteDoc(doc.id);
        renderCurrent();
      };
    }

    grid.appendChild(card);
  });
}

// ----------------------
// UPLOAD
// ----------------------

function loadUpload() {
  content.innerHTML = `
  <div class="upload-box">
    
    <label class="file-picker">
      <input type="file" id="fileInput" multiple hidden>
      <div class="file-ui">
        <div class="icon">📁</div>
        <p>Select files</p>
      </div>
    </label>

    <button id="uploadBtn">Upload</button>
    <div id="status"></div>

  </div>
`;

  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("status");

  // show selected files BEFORE upload
  fileInput.onchange = () => {
    status.innerHTML = "";
    for (const file of fileInput.files) {
      const p = document.createElement("p");
      p.textContent = file.name;
      status.appendChild(p);
    }
  };

  uploadBtn.onclick = async () => {
    const files = fileInput.files;

    if (!files.length) {
      status.textContent = "Select file(s)";
      return;
    }

    status.innerHTML = "";

    for (const file of files) {
      const doc = {
        id: crypto.randomUUID(),
        name: file.name,
        blob: file,
        pinned: false,
        createdAt: Date.now(),
      };

      await addDoc(doc);

      const p = document.createElement("p");
      p.textContent = "✔ " + file.name;
      status.appendChild(p);
    }

    fileInput.value = "";
  };
}

// ----------------------
// VIEWER
// ----------------------

function openViewer(doc) {
  lastTab = currentTab;

  const url = URL.createObjectURL(doc.blob);

  let viewerContent = "";

  if (doc.blob.type.startsWith("image/")) {
    viewerContent = `<img src="${url}" style="width:100%">`;
  } else if (doc.blob.type === "application/pdf") {
    viewerContent = `<iframe src="${url}" width="100%" height="400"></iframe>`;
  } else {
    viewerContent = `<a href="${url}" download>Download</a>`;
  }

  content.innerHTML = `
    <div>
      <h3>${doc.name}</h3>
      ${viewerContent}
      <br><br>
      <button id="download">Download</button>
      <button id="share">Share</button>
      <button id="back">Back</button>
    </div>
  `;

  document.getElementById("download").onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  };

  document.getElementById("share").onclick = async () => {
    try {
      if (navigator.share && navigator.canShare?.({ files: [doc.blob] })) {
        await navigator.share({
          title: doc.name,
          files: [doc.blob],
        });
      } else {
        // fallback for desktop
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name;
        a.click();
      }
    } catch (err) {
      console.log("Share cancelled or failed");
    }
  };

  document.getElementById("back").onclick = () => {
    currentTab = lastTab;

    tabs.forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === currentTab);
    });

    updateSearchState();
    renderCurrent();
  };
}

// ----------------------

updateSearchState();
renderCurrent();

let touchStartX = 0;
let touchEndX = 0;

const tabOrder = ["home", "library", "upload"];

document.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const diff = touchStartX - touchEndX;

  // ignore small swipes
  if (Math.abs(diff) < 50) return;

  let index = tabOrder.indexOf(currentTab);

  if (diff > 0) {
    // swipe left → next
    if (index < tabOrder.length - 1) index++;
  } else {
    // swipe right → previous
    if (index > 0) index--;
  }

  const nextTab = tabOrder[index];

  if (nextTab !== currentTab) {
    currentTab = nextTab;

    tabs.forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === currentTab);
    });

    updateSearchState();
    renderCurrent();
  }
}
