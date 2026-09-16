import { Agent } from "clanker-cleanroom";

import { cursorBinding } from "./binding.js";

export const cursorAgent = Agent.fromBinding(cursorBinding);
