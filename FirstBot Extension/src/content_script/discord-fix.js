const script = document.createElement('script')
script.src = chrome.runtime.getURL('src/overrides/discord.js')
script.defer = true;
(document.head || document.documentElement).appendChild(script);
script.remove();