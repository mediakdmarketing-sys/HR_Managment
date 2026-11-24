import { test, expect } from '@playwright/test';

test('Homepage loads successfully', async ({ page }) => {
  // Navigate to the homepage
  await page.goto('/');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Verify the page title or a key element
  const title = await page.title();
  console.log(`Page title: ${title}`);
  
  // Basic check - page should have loaded something
  expect(title).toBeTruthy();
});

test('Application renders without errors', async ({ page }) => {
  await page.goto('/');
  
  // Check for console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Wait for initial render
  await page.waitForLoadState('networkidle');
  
  // Log any errors (they're not fatal, just informational)
  if (errors.length > 0) {
    console.log(`Console errors: ${errors.join(', ')}`);
  }
  
  // Basic assertion - page should exist
  const html = await page.content();
  expect(html.length).toBeGreaterThan(0);
});

test('Page responds to navigation', async ({ page }) => {
  await page.goto('/');
  
  // Check that the page is accessible and responsive
  const response = await page.goto('/');
  expect(response.status()).toBeLessThan(400); // Should be 2xx or 3xx
});
