/** `node:url`-এর shim (ডেমো স্টোর ব্যবহার করে না, তবে নিরাপদে রাখা)। */
export function fileURLToPath(url: string | URL) {
  const value = typeof url === "string" ? url : url.href;
  return value.replace(/^file:\/\//, "");
}

export default { fileURLToPath };
