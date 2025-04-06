# Social Media Embed Viewer

A vanilla JavaScript application that allows you to collect and display embedded social media posts from various platforms (Twitter/X, Instagram, YouTube) in a responsive masonry grid layout with advanced tag management and rich website previews.

## Features

- Paste social media links and see them embedded instantly
- Add tags while submitting links or edit them later
- Filter posts by tags with an intuitive tag filtering system
- Inline tag editing with immediate UI updates
- Smooth animations for adding and removing content
- Responsive masonry grid layout that adapts to any screen size
- Rich website previews with thumbnails, titles, and descriptions
- Infinite scrolling for efficient browsing of large collections
- Optimized performance for 1000+ saved links
- Persistent storage using IndexedDB (falls back to localStorage)
- Support for:
  - Twitter/X posts
  - Instagram posts
  - YouTube videos
  - Rich website previews for all other URLs

## Usage

1. Open `index.html` in a modern web browser
2. Paste a social media link into the input field
3. Add comma-separated tags (optional)
4. Click "Add Link" to save and display the embedded content
5. Click on tag buttons to filter your collection
6. Add new tags to existing posts by clicking the "+" button
7. Remove tags by clicking the "×" on any tag
8. Delete posts with the "×" button in the top-right corner
9. Scroll down to automatically load more posts

## Supported Link Types

- Twitter/X: Regular tweet URLs (supports both twitter.com and x.com domains)
- Instagram: Post URLs (embedded with official Instagram embed)
- YouTube: Video URLs (regular or shortened links with responsive player)
- Websites: Any URL displays with rich preview including:
  - Website favicon
  - Meta image/thumbnail
  - Page title
  - Page description

## Technical Details

- Built with vanilla JavaScript (no frameworks or dependencies)
- Uses IndexedDB for storage (falls back to localStorage if unavailable)
- Implements pagination and infinite scrolling for performance
- Optimized DOM operations for handling large collections
- Responsive design using CSS Grid and Flexbox
- Implements official embedding methods for social media platforms
- Uses Open Graph and Twitter Card metadata for rich website previews
- Debounced rendering to prevent performance issues
- Memory-optimized event handling to prevent leaks
