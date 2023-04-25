import { verbose } from "../index.js";
export default function log(text, isVerbose = false) {
  if ((isVerbose == true && verbose == true) || isVerbose == false) {
    var d = new Date().toISOString();
    console.log("[" + d + "] " + text);
  }
}
