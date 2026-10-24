#!/bin/bash
# Install the compatible version of the JSON datasource plugin
grafana cli plugins install marcusolsson-json-datasource 1.3.27 2>/dev/null || true

exec /run.sh
