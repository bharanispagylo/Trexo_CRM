@echo off
echo Setting remote to https://github.com/bharanispagylo/Trexo_CRM.git...
git remote set-url origin https://github.com/bharanispagylo/Trexo_CRM.git || git remote add origin https://github.com/bharanispagylo/Trexo_CRM.git

echo Removing embedded UI git if exists...
git rm -rf --cached ui >nul 2>&1
rd /s /q "ui\.git" >nul 2>&1

echo Adding files and committing...
git add .
git commit -m "Final push: Office CRM with all modules"

echo Pushing to GitHub...
git branch -M main
git push -u origin main --force

echo Done!
pause
