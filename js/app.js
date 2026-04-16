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
// LAZY LOADING OBSERVER
// ----------------------

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        loadThumbnail(el);
        observer.unobserve(el);
      }
    });
  },
  {
    rootMargin: "120px",
  },
);

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

// ----------------------
// FILTER
// ----------------------

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
  const context = canvas.getContext("2d");

  const viewport = page.getViewport({ scale: 0.5 });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL();
}

// ----------------------
// THUMBNAIL LOADER
// ----------------------

async function loadThumbnail(el) {
  const doc = el._doc;

  try {
    // cached
    if (doc.thumbnail) {
      el.innerHTML = `<img src="${doc.thumbnail}">`;
      return;
    }

    // image
    if (doc.blob.type.startsWith("image/")) {
      const url = URL.createObjectURL(doc.blob);
      el.innerHTML = `<img src="${url}">`;
      return;
    }

    // pdf
    if (doc.blob.type === "application/pdf") {
      const img = await generatePDFThumbnail(doc.blob);

      el.innerHTML = `<img src="${img}">`;

      doc.thumbnail = img;
      await updateDoc(doc);
      return;
    }

    // fallback
    el.innerHTML = "📄";
  } catch (err) {
    el.innerHTML = "⚠️";
    console.log("Thumbnail error", err);
  }
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

    const isPinned = doc.pinned === true;

    // skeleton thumb
    const thumbEl = document.createElement("div");
    thumbEl.className = "thumb skeleton";
    thumbEl.innerHTML = "";

    thumbEl._doc = doc;
    observer.observe(thumbEl);

    // content
    const contentDiv = document.createElement("div");
    contentDiv.className = "card-content";

    contentDiv.innerHTML = `
      <p class="name">${doc.name}</p>
      <div class="actions">
        <button class="open">Open</button>
        <button class="pin">${isPinned ? "Unpin" : "Pin"}</button>
        ${!isHome ? `<button class="delete">Delete</button>` : ""}
      </div>
    `;

    card.appendChild(thumbEl);
    card.appendChild(contentDiv);

    // actions
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
        thumbnail: null, // 🔥 important
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

  // ✅ FIX: mobile-safe PDF handling
  if (doc.blob.type === "application/pdf") {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();

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
      <div class="viewer-content">
        ${viewerContent}
      </div>

      <div class="viewer-actions">
        <button id="download">Download</button>
        <button id="share">Share</button>
        <button id="back">Back</button>
      </div>
    </div>
  `;

  // Download
  document.getElementById("download").onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  };

  // Share
  document.getElementById("share").onclick = async () => {
    try {
      if (navigator.share && navigator.canShare?.({ files: [doc.blob] })) {
        await navigator.share({
          title: doc.name,
          files: [doc.blob],
        });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name;
        a.click();
      }
    } catch {
      console.log("Share cancelled");
    }
  };

  // Back
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
// SWIPE (FIXED PROPERLY)
// ----------------------

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let isMultiTouch = false;
let swipeTarget = null;

const tabOrder = ["home", "library", "upload"];

document.addEventListener("touchstart", (e) => {
  // ❌ ignore pinch
  if (e.touches.length > 1) {
    isMultiTouch = true;
    return;
  }

  isMultiTouch = false;

  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;

  // track where swipe started
  swipeTarget = e.target;
});

document.addEventListener("touchend", (e) => {
  if (isMultiTouch) return;

  // ❌ ignore inside viewer (image zoom etc.)
  if (swipeTarget && swipeTarget.closest(".viewer")) return;

  touchEndX = e.changedTouches[0].screenX;
  handleSwipe(e);
});

function handleSwipe(e) {
  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - e.changedTouches[0].screenY;

  // ❌ ignore vertical gestures
  if (Math.abs(diffY) > Math.abs(diffX)) return;

  // ❌ ignore small swipes
  if (Math.abs(diffX) < 60) return;

  let index = tabOrder.indexOf(currentTab);

  if (diffX > 0 && index < tabOrder.length - 1) index++;
  if (diffX < 0 && index > 0) index--;

  const nextTab = tabOrder[index];

  if (nextTab === currentTab) return;

  // smooth animation
  content.style.transition = "opacity 0.15s, transform 0.15s";
  content.style.opacity = "0";
  content.style.transform =
    diffX > 0 ? "translateX(-20px)" : "translateX(20px)";

  setTimeout(() => {
    currentTab = nextTab;

    tabs.forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === currentTab);
    });

    updateSearchState();
    renderCurrent();

    content.style.transform =
      diffX > 0 ? "translateX(20px)" : "translateX(-20px)";

    requestAnimationFrame(() => {
      content.style.opacity = "1";
      content.style.transform = "translateX(0)";
    });
  }, 150);
}

// ----------------------

updateSearchState();
renderCurrent();

setTimeout(() => {
  let tapCount = 0;
  let lastTapTime = 0;

  document.addEventListener("touchstart", (e) => {
    // ignore UI elements
    if (e.target.closest("button") || e.target.closest(".card")) return;

    // ignore multi-touch (pinch etc.)
    if (e.touches.length > 1) return;

    const now = Date.now();

    // reset if too slow
    if (now - lastTapTime > 1200) {
      tapCount = 0;
    }

    tapCount++;
    lastTapTime = now;

    if (tapCount >= 5) {
      tapCount = 0;

      const code = Math.random().toString(36).slice(2, 7);
      const input = prompt(`Enter code: ${code}`);

      if (input === code) {
        hardRefresh();
      }
    }
  });

  function hardRefresh() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }

    // force real reload
    window.location.href =
      window.location.href.split("?")[0] + "?v=" + Date.now();
  }
}, 500);
