UPDATE permission SET code = 'recipe.manage', description = 'Full CRUD on recipes and ingredients'
  WHERE code = 'ingredient.manage';
UPDATE permission SET code = 'recipe.read',   description = 'Read-only access to recipes and ingredients'
  WHERE code = 'ingredient.read';
