/* ==========================================================================
   BeatBotAdmin - Taxonomy Manager (Categories, Languages, Countries)
   ========================================================================== */

/**
 * Load Categories View
 */
async function loadCategoriesData() {
  const container = document.getElementById('categories-grid-container');
  if (!container) return;

  container.innerHTML = '<div class="empty-state"><p>Loading categories...</p></div>';

  try {
    let categories = [];
    if (db) {
      const snap = await db.collection("categories").get();
      snap.forEach(doc => {
        categories.push({ id: doc.id, name: doc.data().name });
      });
    }

    if (categories.length === 0) categories = DEFAULT_CATEGORIES.map(c => ({ id: null, name: c }));

    container.innerHTML = categories.map(cat => `
      <div class="taxonomy-item">
        <span>${escapeHtml(cat.name)}</span>
        ${cat.id ? `
          <button class="icon-btn btn-delete" onclick="deleteTaxonomyItem('categories', '${cat.id}', '${escapeHtml(cat.name)}')" title="Delete Category">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        ` : `<span class="pill-badge">Default</span>`}
      </div>
    `).join('');

  } catch (err) {
    console.error("BeatBotAdmin: Categories error", err);
    showToast('Failed to load categories', 'error');
  }
}

async function addNewCategorySubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('new-category-input');
  const name = input?.value.trim();

  if (!name) {
    showToast('Category name cannot be empty', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("categories").add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showToast(`Category "${name}" added!`, 'success');
    if (input) input.value = '';
    await loadCategoriesData();
  } catch (err) {
    showToast('Failed to add category: ' + err.message, 'error');
  }
}

/**
 * Load Languages View
 */
async function loadLanguagesData() {
  const container = document.getElementById('languages-grid-container');
  if (!container) return;

  container.innerHTML = '<div class="empty-state"><p>Loading languages...</p></div>';

  try {
    let languages = [];
    if (db) {
      const snap = await db.collection("languages").get();
      snap.forEach(doc => {
        languages.push({ id: doc.id, name: doc.data().name });
      });
    }

    if (languages.length === 0) languages = DEFAULT_LANGUAGES.map(l => ({ id: null, name: l }));

    container.innerHTML = languages.map(lang => `
      <div class="taxonomy-item">
        <span>${escapeHtml(lang.name)}</span>
        ${lang.id ? `
          <button class="icon-btn btn-delete" onclick="deleteTaxonomyItem('languages', '${lang.id}', '${escapeHtml(lang.name)}')" title="Delete Language">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        ` : `<span class="pill-badge">Default</span>`}
      </div>
    `).join('');

  } catch (err) {
    console.error("BeatBotAdmin: Languages error", err);
    showToast('Failed to load languages', 'error');
  }
}

async function addNewLanguageSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('new-language-input');
  const name = input?.value.trim();

  if (!name) {
    showToast('Language name cannot be empty', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("languages").add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showToast(`Language "${name}" added!`, 'success');
    if (input) input.value = '';
    await loadLanguagesData();
  } catch (err) {
    showToast('Failed to add language: ' + err.message, 'error');
  }
}

/**
 * Load Countries View
 */
async function loadCountriesData() {
  const container = document.getElementById('countries-grid-container');
  if (!container) return;

  container.innerHTML = '<div class="empty-state"><p>Loading countries...</p></div>';

  try {
    let countries = [];
    if (db) {
      const snap = await db.collection("countries").get();
      snap.forEach(doc => {
        countries.push({ id: doc.id, name: doc.data().name });
      });
    }

    if (countries.length === 0) countries = DEFAULT_COUNTRIES.map(c => ({ id: null, name: c }));

    container.innerHTML = countries.map(c => `
      <div class="taxonomy-item">
        <span>${escapeHtml(c.name)}</span>
        ${c.id ? `
          <button class="icon-btn btn-delete" onclick="deleteTaxonomyItem('countries', '${c.id}', '${escapeHtml(c.name)}')" title="Delete Country">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        ` : `<span class="pill-badge">Default</span>`}
      </div>
    `).join('');

  } catch (err) {
    console.error("BeatBotAdmin: Countries error", err);
    showToast('Failed to load countries', 'error');
  }
}

async function addNewCountrySubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('new-country-input');
  const name = input?.value.trim();

  if (!name) {
    showToast('Country name cannot be empty', 'error');
    return;
  }

  try {
    if (db) {
      await db.collection("countries").add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showToast(`Country "${name}" added!`, 'success');
    if (input) input.value = '';
    await loadCountriesData();
  } catch (err) {
    showToast('Failed to add country: ' + err.message, 'error');
  }
}

/**
 * Generic Delete Taxonomy Item (Category, Language, Country)
 */
async function deleteTaxonomyItem(collection, docId, itemName) {
  if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;

  try {
    if (db) {
      await db.collection(collection).doc(docId).delete();
    }
    showToast(`Deleted "${itemName}"`, 'success');
    if (collection === 'categories') loadCategoriesData();
    if (collection === 'languages') loadLanguagesData();
    if (collection === 'countries') loadCountriesData();
  } catch (err) {
    showToast('Failed to delete item: ' + err.message, 'error');
  }
}
