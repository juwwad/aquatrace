# AquaTrace

AquaTrace is a Chromium browser extension that estimates the water footprint of your AI conversations. It tracks prompt activity on supported sites such as ChatGPT, Gemini, and Claude, and shows an easy-to-read visual estimate in the popup.

## What it does

- Estimates the water impact of prompts based on token count
- Tracks usage by site
- Displays a visual water-meter style summary in the extension popup
- Supports two water-impact modes:
  - Direct cooling estimate
  - Full lifecycle estimate

## Download the project locally

Download the full extension folder as a ZIP archive here:

- [Download AquaTrace folder](aquatrace.zip)

After downloading, extract the ZIP file to a folder on your computer.

## Install in developer mode

This extension is built for Chromium-based browsers such as Chrome, Edge, Brave, Opera, and Vivaldi.

### General steps

1. Download and extract the project folder.
2. Open your browser.
3. Go to the Extensions page:
   - Chrome: chrome://extensions
   - Edge: edge://extensions
   - Brave: brave://extensions
   - Opera: opera://extensions
   - Vivaldi: vivaldi://extensions
4. Turn on Developer mode.
5. Click Load unpacked / Load extension.
6. Select the folder that contains manifest.json.
7. The extension should appear in your browser and be ready to use.

## Windows instructions

1. Download the ZIP file and extract it to a folder such as Desktop\AquaTrace.
2. Open Chrome or Edge.
3. Navigate to the Extensions page.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the extracted AquaTrace folder.
7. Pin the extension from the toolbar if you want quick access.

## Mac instructions

1. Download the ZIP file and extract it to a folder such as ~/Downloads/AquaTrace.
2. Open Chrome or Edge.
3. Go to the Extensions page.
4. Enable Developer mode.
5. Click Load unpacked.
6. Choose the extracted AquaTrace folder.
7. Pin the extension for easier access.

## Using the extension

1. Open a supported AI site such as ChatGPT, Gemini, or Claude.
2. Start chatting normally.
3. Click the AquaTrace icon in your browser toolbar.
4. View your estimated water footprint and prompt totals.
5. Use the mode toggle in the popup to switch between direct cooling and full lifecycle estimates.

## Notes

- The extension works best on supported sites listed in the manifest.
- It estimates usage locally in your browser and does not send your prompt text to a server.
- If you make changes to the source files, reload the extension from the Extensions page to apply them.

## Troubleshooting

- If the extension does not appear, make sure you selected the folder that contains manifest.json.
- If the popup is empty, refresh the page and try again.
- If you update the files, click the Reload button on the extension card in the Extensions page.
