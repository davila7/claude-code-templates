# Create Pull Request using GitHub CLI
# Make sure you have GitHub CLI installed: https://cli.github.com/

$prBody = Get-Content -Path "PR_DESCRIPTION.md" -Raw

gh pr create `
  --title "🎨 Modern Violet Theme + Copy Button Fix" `
  --body $prBody `
  --base main `
  --head enhancing-modern-colour-schema `
  --label "enhancement" `
  --label "bug-fix" `
  --label "ui/ux"

Write-Host ""
Write-Host "✅ Pull Request Created Successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "PR includes:" -ForegroundColor Cyan
Write-Host "  • Modern violet-tinted AI/futuristic theme" -ForegroundColor White
Write-Host "  • 13 components updated with new color system" -ForegroundColor White
Write-Host "  • Branded gradient circles on featured cards" -ForegroundColor White
Write-Host "  • Floating glassmorphism Stack Builder UI" -ForegroundColor White
Write-Host "  • Fixed copy buttons for HTTP/HTTPS contexts" -ForegroundColor White
Write-Host ""
