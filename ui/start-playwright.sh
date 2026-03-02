#!/bin/bash

export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$PLAYwrightPath"

# Start dev server in background
cd /home/blake/Documents/software/bifrost/ui
npm run dev & &
sleep 5

echo "Dev server started"
