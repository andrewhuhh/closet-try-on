# Closet Try-On: Virtual Clothing Try-On with Gemini AI

This Chrome extension allows you to virtually try on clothing items you find while browsing online using Google's Gemini AI for realistic image generation.

## Features

- **Virtual Try-On**: Right-click any clothing image online and instantly see how it looks on you
- **Avatar Generation**: Create personalized avatar models from your photos
- **Wardrobe Management**: Save clothing items for later try-ons
- **Outfit Gallery**: View all your generated outfits in one place

## Prerequisites

- **Chrome Browser** (version 138+)
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

## Setup Instructions

### 1. Get Your Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Copy the API key (keep it secure!)

### 2. Install the Extension
1. Download or clone this repository
2. Open Chrome and go to chrome://extensions/
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select this directory

### 3. Initial Setup
1. Click the extension icon in Chrome toolbar
2. Enter your Gemini API key and click "Save API Key"
3. Upload 3+ photos of yourself for avatar generation
4. Select your gender (for sample outfit generation)
5. Click "Generate Avatar" to create your personalized models

## How to Use

### Try On Clothing
1. Browse any website with clothing images
2. Right-click on a clothing item
3. Select **"Try It On"** from the context menu
4. Wait for AI generation (opens popup with result)

### Save Clothing for Later
1. Right-click on interesting clothing images
2. Select **"Add to Outfit"** to save to your wardrobe

### View Your Content
- **My Outfits**: See all generated try-on results
- **My Wardrobe**: Browse saved clothing items
- **Latest Try-On**: View your most recent result

## Technical Details

### APIs Used
- **Gemini 2.5 Flash Image Preview**: For AI image generation
- **Chrome Storage API**: For storing API keys and user data
- **Chrome Context Menus**: For right-click functionality

### Image Generation Prompts
The extension uses detailed prompts based on your New-Idea.md specifications:
- Avatar generation with 4 different poses
- Realistic clothing overlay with proper fit and drape
- White background and high-resolution output

### Data Storage
- API keys (locally stored)
- Generated avatars
- Saved clothing items
- Generated outfit results
- User preferences (gender, selected avatar)

## Privacy & Security

- All image processing happens through Google's Gemini API
- Your API key is stored locally in Chrome storage
- Images are converted to base64 for API transmission
- No user data is sent to external servers except API calls

## Troubleshooting

### Common Issues
- **"API Key Required"**: Make sure you've entered a valid Gemini API key
- **"Avatar Required"**: Complete the avatar setup process first
- **Generation Failed**: Check your API key validity and internet connection

### API Limits
- Gemini API has rate limits and token costs
- Monitor your usage in Google AI Studio
- Free tier has limited requests per minute

## Development

This extension is built with:
- **HTML/CSS/JavaScript** for the UI
- **Chrome Extension APIs** for browser integration
- **Gemini REST API** for AI image generation
- **Open Props** for consistent styling

### File Structure
`
 manifest.json          # Extension configuration
 background.js          # Context menu and API integration
 popup.html            # Main UI interface
 popup.js              # UI logic and state management
 icons/                # Extension icons
 New-Idea.md           # Original project specifications
`

## Contributing

This is a sample extension demonstrating AI-powered virtual try-on functionality. Feel free to extend it with:
- Multiple avatar support
- Outfit combination features
- Social sharing capabilities
- Enhanced styling options

## License

This sample is provided as-is for educational purposes.
