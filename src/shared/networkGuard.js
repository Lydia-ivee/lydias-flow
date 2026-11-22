// The offline guarantee, as one rule: the running app may only talk to itself.
//
// Speech-to-text and the clean-up model run as local servers on 127.0.0.1, and
// the windows load local files. Everything else (any website, any analytics,
// any update check) is refused. Models are downloaded once by `npm run setup`,
// never by the running app, so there are no exceptions to make.

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const LOCAL_PROTOCOLS = new Set(["file:", "devtools:", "data:", "blob:"]);
const NETWORK_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

function isAllowedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false; // anything we cannot parse is refused
  }
  if (LOCAL_PROTOCOLS.has(parsed.protocol)) return true;
  if (NETWORK_PROTOCOLS.has(parsed.protocol)) return LOCAL_HOSTS.has(parsed.hostname);
  return false;
}

// Electron hook: called for every request any window makes.
function installNetworkGuard(session, onBlocked = () => {}) {
  session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUrl(details.url);
    if (!allowed) onBlocked(details.url);
    callback({ cancel: !allowed });
  });
}

module.exports = { isAllowedUrl, installNetworkGuard };
