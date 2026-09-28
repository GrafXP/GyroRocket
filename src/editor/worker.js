import { validateLevel } from "../sim/validate.js";
import { checkLevel } from "../sim/check.js";
import { flyLevel } from "../autofly.js";

self.onmessage = ({ data: { action, level } }) => {
  try {
    validateLevel(level);
    const result =
      action === "check"
        ? checkLevel(level)
        : flyLevel(level, {
            progress: (progress) => self.postMessage({ progress }),
          });
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
