# Initialize Git
git init

# Add all files
git add .

# Initial Commit
git commit -m "Initial commit: Full Office CRM project with RBAC and Leave module updates"

# Add Remote
git remote add origin https://github.com/bharanispagylo/Trexo_CRM.git

# Rename branch to main
git branch -M main

# Push to GitHub
# Note: You might need to authenticate if you haven't already.
git push -u origin main
