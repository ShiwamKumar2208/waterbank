import {
  initDB,
  getAllDocs,
  getPinnedDocs,
  addDoc,
  togglePin,
  deleteDoc,
  updateDoc,
} from "./db.js";

const content = document.getElementById("content");
const tabs = document.querySelectorAll(".tabs button");
const searchInput = document.getElementById("searchInput");

let currentTab = "home";
let lastTab = "home";

await initDB();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// ----------------------
// SEARCH STATE
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
// TABS
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
// SEARCH
// ----------------------

searchInput.oninput = () => {
  if (currentTab === "upload") return;
  renderCurrent();
};

// ----------------------
// OBSERVER
// ----------------------

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadThumbnail(entry.target);
        observer.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "120px" }
);

// ----------------------
// MAIN RENDER
// ----------------------

async function renderCurrent() {
  const query = searchInput.value.toLowerCase();

  if (currentTab === "home") {
    const docs = await getPinnedDocs();
    renderDocs(filterDocs(docs, query), true);
  }

  if (currentTab === "library") {
    const docs = await getAllDocs();
    renderDocs(filterDocs(docs, query), false);
  }

  if (currentTab === "upload") loadUpload();
}

function filterDocs(docs, query) {
  if (!query) return docs;
  return docs.filter((d) => d.name.toLowerCase().includes(query));
}

// ----------------------
// PDF THUMBNAIL
// ----------------------

async function generatePDFThumbnail(blob) {
  const url = URL.createObjectURL(blob);
  const pdf = await pdfjsLib.getDocument(url).promise;
  const page = await pdf.getPage(1);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const viewport = page.getViewport({ scale: 0.5 });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL();
}

// ----------------------
// THUMBNAIL
// ----------------------

async function loadThumbnail(el) {
  const doc = el._doc;

  try {
    if (doc.thumbnail) {
      const img = new Image();
      img.src = doc.thumbnail;

      el.classList.remove("skeleton");
      el.replaceChildren(img);
      return;
    }

    if (doc.blob.type.startsWith("image/")) {
      const url = URL.createObjectURL(doc.blob);
      const img = new Image();
      img.src = url;

      img.onload = () => setTimeout(() => URL.revokeObjectURL(url), 5000);

      el.classList.remove("skeleton");
      el.replaceChildren(img);
      return;
    }

    if (doc.blob.type === "application/pdf") {
      const imgSrc = await generatePDFThumbnail(doc.blob);

      const img = new Image();
      img.src = imgSrc;

      el.classList.remove("skeleton");
      el.replaceChildren(img);

      doc.thumbnail = imgSrc;
      await updateDoc(doc);
      return;
    }

    el.classList.remove("skeleton");
    el.textContent = "📄";
  } catch {
    el.classList.remove("skeleton");
    el.textContent = "⚠️";
  }
}

// ----------------------
// RENDER DOCS
// ----------------------

function renderDocs(docs, isHome) {
  content.innerHTML = `<div class="grid"></div>`;
  const grid = content.querySelector(".grid");

  if (!docs.length) {
    grid.innerHTML = "<p>No documents</p>";
    return;
  }

  docs.forEach((doc) => {
    const card = document.createElement("div");
    card.className = "card";

    const thumb = document.createElement("div");
    thumb.className = "thumb skeleton";
    thumb._doc = doc;
    observer.observe(thumb);

    const contentDiv = document.createElement("div");
    contentDiv.className = "card-content";

    contentDiv.innerHTML = `
      <p class="name">${doc.name}</p>
      <div class="actions">
        <button class="open">Open</button>
        <button class="pin">${doc.pinned ? "Unpin" : "Pin"}</button>
        ${!isHome ? `<button class="delete">Delete</button>` : ""}
      </div>
    `;

    contentDiv.querySelector(".open").onclick = () => openViewer(doc);

    contentDiv.querySelector(".pin").onclick = async () => {
      await togglePin(doc.id);
      renderCurrent();
    };

    if (!isHome) {
      contentDiv.querySelector(".delete").onclick = async () => {
        await deleteDoc(doc.id);
        renderCurrent();
      };
    }

    card.append(thumb, contentDiv);
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
  const status = document.getElementById("status");

  fileInput.onchange = () => {
    status.innerHTML = "";
    [...fileInput.files].forEach((f) => {
      const p = document.createElement("p");
      p.textContent = f.name;
      status.appendChild(p);
    });
  };

  document.getElementById("uploadBtn").onclick = async () => {
    for (const file of fileInput.files) {
      await addDoc({
        id: crypto.randomUUID(),
        name: file.name,
        blob: file,
        pinned: false,
        createdAt: Date.now(),
        thumbnail: null,
      });
    }
    renderCurrent();
  };
}

// ----------------------
// VIEWER (FIXED)
// ----------------------

function openViewer(doc) {
  lastTab = currentTab;
  const url = URL.createObjectURL(doc.blob);

  // 🔥 FIX: mobile-safe PDF
  if (doc.blob.type === "application/pdf") {
    window.open(url, "_blank");
    return;
  }

  let viewerContent = "";

  if (doc.blob.type.startsWith("image/")) {
    viewerContent = `<img src="${url}" style="width:100%">`;
  } else {
    viewerContent = `<a href="${url}" download>Download</a>`;
  }

  content.innerHTML = `
    <div class="viewer">
      <h3>${doc.name}</h3>
      <div class="viewer-content">${viewerContent}</div>

      <div class="viewer-actions">
        <button id="download">Download</button>
        <button id="share">Share</button>
        <button id="back">Back</button>
      </div>
    </div>
  `;

  document.getElementById("download").onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  };

  document.getElementById("back").onclick = () => {
    currentTab = lastTab;
    tabs.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === currentTab)
    );
    updateSearchState();
    renderCurrent();
  };
}

// ----------------------
// SWIPE (FIXED CLEAN)
// ----------------------

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

const tabOrder = ["home", "library", "upload"];

function handleSwipe() {
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) < 50) return;

  let i = tabOrder.indexOf(currentTab);
  if (diff > 0 && i < 2) i++;
  else if (diff < 0 && i > 0) i--;

  const next = tabOrder[i];
  if (next === currentTab) return;

  // 🔥 smooth fade-slide
  content.style.transition = "opacity 0.15s, transform 0.15s";
  content.style.opacity = "0";
  content.style.transform = diff > 0 ? "translateX(-20px)" : "translateX(20px)";

  setTimeout(() => {
    currentTab = next;

    tabs.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === currentTab)
    );

    updateSearchState();
    renderCurrent();

    content.style.transform = diff > 0
      ? "translateX(20px)"
      : "translateX(-20px)";

    requestAnimationFrame(() => {
      content.style.opacity = "1";
      content.style.transform = "translateX(0)";
    });
  }, 150);
}

// ----------------------

updateSearchState();
renderCurrent();