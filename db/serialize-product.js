// Single source of truth for turning a `products` row (+ ordered image URLs)
// into the public product shape app.js/cart.js expect from data/products.json.
// Used by GET /api/products and by the admin API's publicPreview field so
// both stay byte-for-byte identical.
function serializeProduct(row, images) {
  const orderedImages = images && images.length ? images : (row.image ? [row.image] : []);

  const product = {
    id: row.id,
    type: row.type,
    title: row.title,
    price: Number(row.price),
    image: row.image || orderedImages[0] || null,
    images: orderedImages,
    specs: row.specs || {},
    full_specs: row.full_specs || {},
    description: row.description,
    descPartOne: row.desc_part_one,
    descPartTwo: row.desc_part_two,
    descPartThree: row.desc_part_three,
    descPartFour: row.desc_part_four,
    descPartFive: row.desc_part_five,
    descPartSix: row.desc_part_six,
    olx_url: row.olx_url,
    url: row.prom_url
  };

  if (row.subtype) product.subtype = row.subtype;
  if (row.old_price !== null && row.old_price !== undefined) product.oldPrice = Number(row.old_price);

  return product;
}

module.exports = { serializeProduct };
