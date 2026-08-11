const fs = require("fs");
const path = require("path");

const HANDLES = ["ankiisinghh", "akki.sings__", "_unfav._.akki__"];
const DATA_FILE = path.join(__dirname, "..", "data", "fans.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const APP_ID = "936619743392459";

async function getText(url, headers) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, ...headers },
    redirect: "follow"
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

async function fetchProfile(handle) {
  try {
    const text = await getText(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=" +
        encodeURIComponent(handle),
      {
        "x-ig-app-id": APP_ID,
        origin: "https://www.instagram.com",
        referer: "https://www.instagram.com/"
      }
    );
    const data = JSON.parse(text);
    const user = data && data.data && data.data.user;
    if (user && user.edge_followed_by && typeof user.edge_followed_by.count === "number") {
      const posts = user.edge_owner_to_timeline_media
        ? user.edge_owner_to_timeline_media.count
        : null;
      return { followers: user.edge_followed_by.count, posts: posts };
    }
  } catch (e) {
    console.log("API fetch failed for " + handle + ": " + e.message);
  }

  try {
    const text = await getText("https://www.instagram.com/" + encodeURIComponent(handle) + "/");
    const m = text.match(/"edge_followed_by":\{"count":(\d+)/);
    if (m && m[1]) return { followers: parseInt(m[1], 10), posts: null };
    const m2 = text.match(/"followers":\s*(\d+)/);
    if (m2 && m2[1]) return { followers: parseInt(m2[1], 10), posts: null };
  } catch (e) {
    console.log("Page fetch failed for " + handle + ": " + e.message);
  }

  return null;
}

function readPrev() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return null;
  }
}

async function main() {
  const prev = readPrev();
  const prevByHandle = {};
  if (prev && Array.isArray(prev.accounts)) {
    prev.accounts.forEach(function (a) {
      prevByHandle[a.handle] = a;
    });
  }

  const accounts = [];
  for (const handle of HANDLES) {
    const fresh = await fetchProfile(handle);
    if (fresh) {
      accounts.push({
        handle: handle,
        followers: fresh.followers,
        posts: fresh.posts
      });
      console.log(handle + ": " + fresh.followers + " followers");
    } else if (prevByHandle[handle]) {
      console.log(handle + ": using previous value " + prevByHandle[handle].followers);
      accounts.push({
        handle: handle,
        followers: prevByHandle[handle].followers,
        posts: prevByHandle[handle].posts
      });
    } else {
      console.log(handle + ": no data, skipping");
    }
  }

  if (accounts.length === 0) {
    console.error("Could not fetch any follower data. Keeping existing file.");
    process.exit(1);
  }

  const total = accounts.reduce(function (s, a) {
    return s + a.followers;
  }, 0);
  const data = {
    total: total,
    accounts: accounts,
    updated_at: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log("Total fans: " + total);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
