#!/usr/bin/env node
/**
 * এক কমান্ডেই সার্ভার চালু + একই Wi-Fi-এর অন্য মোবাইল/ল্যাপটপে খোলার লিংক দেখায়।
 * ব্যবহার: npm run share        (পোর্ট বদলাতে: npm run share -- 4000)
 */
import { spawn } from "node:child_process";
import os from "node:os";
import { existsSync } from "node:fs";
import path from "node:path";

const port = Number(process.argv[2] || process.env.PORT || 3000);
const root = path.resolve(import.meta.dirname, "..");

// node_modules ছাড়া কপি করা ফোল্ডারেও যেন বোঝা যায় কী করতে হবে
if (!existsSync(path.join(root, "node_modules"))) {
  console.log("প্রথমবার চলছে — ডিপেন্ডেন্সি বসানো দরকার।");
  console.log("টার্মিনালে চালান:  npm ci");
  console.log("তারপর আবার:  npm run share");
  process.exit(1);
}

function lanAddresses() {
  const list = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal)
        list.push({ name, ip: entry.address });
    }
  }
  // ঘরের Wi-Fi সাধারণত 192.168.x.x / 10.x.x.x হয়ে থাকে
  return list.sort(
    (a, b) =>
      Number(b.ip.startsWith("192.168.")) - Number(a.ip.startsWith("192.168.")),
  );
}

console.log("Rangpur SSC 96 Festival — সার্ভার চালু হচ্ছে…");
const child = spawn(process.execPath, ["server/index.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit",
});

const addresses = lanAddresses();
setTimeout(() => {
  console.log("\n═════════════ অন্য ডিভাইসে খোলার লিংক ═════════════");
  if (!addresses.length) {
    console.log(
      "⚠️  কোনো Wi-Fi/লোকাল নেটওয়ার্ক পাওয়া যায়নি। মোবাইল হটস্পট চালু করে আবার চেষ্টা করুন।",
    );
  } else {
    console.log("একই Wi-Fi-তে থাকা যেকোনো ফোন/ল্যাপটপের ব্রাউজারে খুলুন:");
    for (const a of addresses)
      console.log(`   http://${a.ip}:${port}        (${a.name})`);
  }
  console.log("\nএই কম্পিউটারেও খুলতে পারবেন:  http://localhost:" + port);
  console.log("মোবাইলে QR টিকিট স্ক্যান করতে চাইলে ক্যামেরার অনুমতি দিন।");
  console.log("বন্ধ করতে: Ctrl + C");
  console.log("═════════════════════════════════════════════════════\n");
}, 2500);

const stop = () => {
  child.kill("SIGINT");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
