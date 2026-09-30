# MKG GLOBAL — Fresh Website + Private Admin

This package is the clean reset version of the MKG GLOBAL website with the private admin panel included.

## Cloudflare requirements
- Project: `mkg-global-website`
- KV binding: `MKG_IMAGES`
- Secret: `ADMIN_KEY`
- No R2 required.
- No Cloudflare Zero Trust / Access subscription required.

## Admin
Open `/admin` on the live domain and sign in with the server-side `ADMIN_KEY` secret.

Admin can:
- Upload/replace inventory CSV data.
- Select a product.
- Upload JPG/PNG/WEBP product images.
- Attach multiple images to a product.
- Replace existing product images.

## Product images
Product images have intentionally been removed from this clean package so they can be uploaded manually.
Keep the existing filenames referenced by `inventory.seed.json`, or use the private Admin panel to attach images to products.

Essential brand assets and the payment QR remain in `image/`.

## Important
Do not put `ADMIN_KEY` in GitHub or in public HTML/JavaScript. It must remain a Cloudflare secret.


CLEAN BUILD NOTES
- Product image files are intentionally not included. Upload product images from /admin after deployment.
- Product gallery uses only product-specific ImageUrl values and admin-uploaded /media/ images. No generic phone gallery is injected.
- Missing product images fall back only to /image/mkg_m_placeholder.png.
- Do not add ADMIN_KEY to GitHub or public code.
