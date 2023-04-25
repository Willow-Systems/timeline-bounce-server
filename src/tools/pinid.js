import { v4 as uuidv4 } from "uuid";

export default function generateNewPinID() {
  return "willow-systems-" + uuidv4().split("-")[0];
}
