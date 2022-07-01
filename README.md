# blog

image convert

```bash
for f in ./*.png; do convert -quality 100 -resize 320x -define jpeg:extent=500kb "$f" "${f%.png}.jpeg"; done
```
