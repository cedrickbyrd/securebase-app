 #!/bin/bash
set -e
echo "DESTROY AWS LANDING ZONE"
read -p "Type destroy to confirm: " CONFIRM
if [ "$CONFIRM" = "destroy" ]; then
  cd environments/dev
  terraform destroy
  echo "Resources destroyed"
fi
