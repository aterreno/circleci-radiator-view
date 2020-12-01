set -euf -o pipefail

sed -i "s/CIRCLE_CI_TOKEN/$CIRCLE_CI_TOKEN/" docs/backends.js