# WaterBank

WaterBank is a mobile-first, offline document vault built as a
Progressive Web App (PWA).\
It is designed to provide instant access to important documents with a
clean, fast, and minimal interface.

------------------------------------------------------------------------

## 🚀 Features

### 📁 Document Storage

-   Store documents locally using IndexedDB
-   No cloud dependency
-   Works completely offline

### ⚡ Instant Access

-   Pin important documents
-   Home tab shows only pinned items
-   One-tap access to critical files

### 🖼️ Thumbnail Previews

-   Image files show real previews
-   PDF files display first-page thumbnails
-   Thumbnails are cached for faster loading

### 🚀 Performance Optimizations

-   Lazy loading using IntersectionObserver
-   Only visible thumbnails are rendered
-   Cached thumbnails prevent reprocessing

### 🔍 Live Search

-   Real-time filtering while typing
-   Works across Home and Library tabs
-   Disabled automatically in Upload tab

### 📤 Upload System

-   Custom file picker UI
-   Multi-file upload support
-   Displays selected and uploaded files

### 📱 Mobile-First UI

-   Bottom navigation (Home / Library / Upload)
-   Swipe gestures for tab navigation
-   Sticky search bar

### 📂 Document Management

-   Open, Pin/Unpin, Delete
-   Built-in viewer for images and PDFs
-   Download and Share support

### 📦 PWA Support

-   Installable on mobile and desktop
-   Offline caching via Service Worker

------------------------------------------------------------------------

## 🏗️ Tech Stack

-   Vanilla JavaScript (ES Modules)
-   IndexedDB (local storage)
-   Service Workers (offline support)
-   PDF.js (PDF rendering)

------------------------------------------------------------------------

## 🧠 Architecture

-   Single-page tab-based interface
-   Local-first storage model
-   No external backend
-   Fully self-contained

------------------------------------------------------------------------

## ⚙️ Core Concepts

-   Instant Access (Pinned Documents)
-   Local Storage (IndexedDB)
-   Lazy Rendering
-   Thumbnail Caching

------------------------------------------------------------------------

## 📌 Status

-   Fully functional offline document vault
-   Optimized for performance and usability
-   Mobile-focused experience

------------------------------------------------------------------------

## 💡 Idea

A self-hosted, private alternative to traditional document lockers,
focused on speed, simplicity, and control.
