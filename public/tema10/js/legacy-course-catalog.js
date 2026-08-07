(function(root, factory) {
    'use strict';

    var api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root && root.document) {
        root.legacyCourseCatalog = api.createController(root, root.document);
        root.changePage = function(page) {
            return root.legacyCourseCatalog.changePage(page, true);
        };
        root.legacyCourseCatalog.bootstrap();
    }
})(typeof window !== 'undefined' ? window : null, function() {
    'use strict';

    var SEARCH_DEBOUNCE_MS = 200;
    var MAX_QUERY_LENGTH = 100;
    var ALLOWED_PAGE_SIZES = [12, 30, 50, 100];
    var FEATURE_TERMS = {
        '1': ['3 ay', '3 aylik'],
        '2': ['baslangic', 'sifirdan', 'temel'],
        '3': ['senior', 'ileri'],
        '4': ['canli online', 'online'],
        '5': ['yuz yuze', 'sinif egitimi'],
        '6': ['sertifika', 'certified'],
        '7': ['guncel', '2024', '2025', '2026'],
        '8': ['e devlet', 'edevlet', 'sertifika']
    };

    function normalizeSearchText(value) {
        return String(value || '')
            .toLocaleLowerCase('tr-TR')
            .replace(/ı/g, 'i')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeQuery(value) {
        return String(value || '').trim().slice(0, MAX_QUERY_LENGTH);
    }

    function filterTitles(titles, query) {
        var normalizedQuery = normalizeSearchText(normalizeQuery(query));
        var values = Array.isArray(titles) ? titles : [];

        if (!normalizedQuery) return values.slice();

        return values.filter(function(title) {
            return normalizeSearchText(title).indexOf(normalizedQuery) !== -1;
        });
    }

    function paginationPages(currentPage, totalPages) {
        var pages = [];
        var page;

        if (totalPages <= 10) {
            for (page = 1; page <= totalPages; page += 1) pages.push(page);
            return pages;
        }

        for (page = 1; page <= totalPages; page += 1) {
            if (
                page === 1
                || page === totalPages
                || (page >= currentPage - 2 && page <= currentPage + 2)
            ) {
                pages.push(page);
            } else if (
                (page === currentPage - 3 || page === currentPage + 3)
                && pages[pages.length - 1] !== 'ellipsis'
            ) {
                pages.push('ellipsis');
            }
        }

        return pages;
    }

    function positiveInteger(value, fallback) {
        var parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    function createController(windowObject, documentObject) {
        var state = {
            initialized: false,
            entries: [],
            matches: [],
            input: null,
            form: null,
            pagination: null,
            result: null,
            emptyState: null,
            timer: null,
            query: '',
            currentPage: 1,
            pageSize: 12,
            serverQuery: normalizeQuery(new windowObject.URL(windowObject.location.href).searchParams.get('q') || '')
        };

        function currentUrl() {
            return new windowObject.URL(windowObject.location.href);
        }

        function pageSizeFromUrl() {
            var requested = positiveInteger(currentUrl().searchParams.get('ps'), 12);
            return ALLOWED_PAGE_SIZES.indexOf(requested) === -1 ? 12 : requested;
        }

        function urlParameterList(name) {
            var value = currentUrl().searchParams.get(name);
            return value ? value.split(',').map(function(item) {
                return item.trim();
            }).filter(Boolean) : [];
        }

        function selectedFeatureGroups() {
            return urlParameterList('f').map(function(featureId) {
                return (FEATURE_TERMS[featureId] || []).map(normalizeSearchText);
            }).filter(function(terms) {
                return terms.length > 0;
            });
        }

        function syncFeatureCheckboxes() {
            urlParameterList('f').forEach(function(featureId) {
                if (!/^\d+$/.test(featureId)) return;
                var checkbox = documentObject.getElementById('feature_' + featureId);
                if (checkbox) checkbox.checked = true;
            });
        }

        function cardTitle(card) {
            var title = card.querySelector('.uv-product-card-item-name');
            return title ? title.textContent.trim() : '';
        }

        function cardFeatureText(card) {
            var privateInfo = card.querySelector('.uv-private-info');
            var image = card.querySelector('img');
            var productLink = card.querySelector('a[href*="/urun/"]');

            return normalizeSearchText([
                privateInfo ? privateInfo.textContent : '',
                image ? image.getAttribute('alt') : '',
                productLink ? productLink.getAttribute('href') : ''
            ].join(' '));
        }

        function collectEntries() {
            var cards = documentObject.querySelectorAll(
                '.uv-product-card-area-4 .uv-product-card-item'
            );

            state.entries = Array.prototype.map.call(cards, function(card) {
                return {
                    element: card,
                    searchText: normalizeSearchText([
                        cardTitle(card),
                        cardFeatureText(card)
                    ].join(' ')),
                    featureText: cardFeatureText(card)
                };
            });
        }

        function ensureEmptyState() {
            var grid;

            if (state.emptyState) return;
            grid = documentObject.querySelector('.uv-product-card-area-4');
            if (!grid || !grid.parentNode) return;

            state.emptyState = documentObject.createElement('div');
            state.emptyState.className = 'alert alert-info uv-course-search-empty';
            state.emptyState.setAttribute('role', 'status');
            state.emptyState.textContent = 'Aramanızla eşleşen eğitim bulunamadı.';
            state.emptyState.hidden = true;
            grid.parentNode.insertBefore(state.emptyState, grid);
        }

        function createPageLink(page, label, active) {
            var item = documentObject.createElement('li');
            var link = documentObject.createElement('a');
            var url = currentUrl();

            url.searchParams.set('pg', String(page));
            link.href = url.pathname + url.search;
            link.textContent = label;

            if (active) {
                item.className = 'active';
                link.setAttribute('aria-current', 'page');
            } else {
                link.setAttribute('data-catalog-page', String(page));
            }

            item.appendChild(link);
            return item;
        }

        function renderPagination(totalPages) {
            var fragment;

            if (!state.pagination) return;
            state.pagination.textContent = '';
            state.pagination.hidden = totalPages <= 1;
            if (totalPages <= 1) return;

            fragment = documentObject.createDocumentFragment();

            if (state.currentPage > 1) {
                fragment.appendChild(createPageLink(state.currentPage - 1, '‹', false));
            }

            paginationPages(state.currentPage, totalPages).forEach(function(page) {
                var item;
                var label;

                if (page === 'ellipsis') {
                    item = documentObject.createElement('li');
                    item.className = 'disabled';
                    label = documentObject.createElement('span');
                    label.textContent = '…';
                    item.appendChild(label);
                    fragment.appendChild(item);
                    return;
                }

                fragment.appendChild(createPageLink(
                    page,
                    String(page),
                    page === state.currentPage
                ));
            });

            if (state.currentPage < totalPages) {
                fragment.appendChild(createPageLink(state.currentPage + 1, '›', false));
            }

            state.pagination.appendChild(fragment);
        }

        function render() {
            var totalPages = Math.max(1, Math.ceil(state.matches.length / state.pageSize));
            var start;
            var end;

            state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
            start = (state.currentPage - 1) * state.pageSize;
            end = start + state.pageSize;

            state.entries.forEach(function(entry) {
                entry.element.hidden = true;
            });
            state.matches.slice(start, end).forEach(function(entry) {
                entry.element.hidden = false;
            });

            if (state.result) {
                state.result.textContent = state.matches.length + ' ürün bulundu';
            }
            if (state.emptyState) {
                state.emptyState.hidden = state.matches.length !== 0;
            }

            renderPagination(state.matches.length ? totalPages : 0);
        }

        function replaceUrl(query, page, mode) {
            var url = currentUrl();

            if (query) url.searchParams.set('q', query);
            else url.searchParams.delete('q');
            url.searchParams.set('pg', String(page));

            windowObject.history[mode + 'State']({}, '', url.pathname + url.search + url.hash);
        }

        function navigateForServerScopedSearch(query) {
            var url = currentUrl();

            if (query) url.searchParams.set('q', query);
            else url.searchParams.delete('q');
            url.searchParams.set('pg', '1');
            windowObject.location.assign(url.pathname + url.search + url.hash);
        }

        function applySearch(rawQuery, options) {
            var settings = options || {};
            var query = normalizeQuery(rawQuery);
            var normalizedQuery = normalizeSearchText(query);
            var normalizedServerQuery = normalizeSearchText(state.serverQuery);
            var featureGroups;

            initialize();

            if (
                normalizedServerQuery
                && normalizedQuery !== normalizedServerQuery
                && settings.allowNavigation !== false
            ) {
                navigateForServerScopedSearch(query);
                return false;
            }

            state.query = query;
            state.currentPage = positiveInteger(settings.page, 1);
            state.pageSize = pageSizeFromUrl();
            featureGroups = selectedFeatureGroups();

            state.matches = state.entries.filter(function(entry) {
                var matchesTitle = !normalizedQuery
                    || entry.searchText.indexOf(normalizedQuery) !== -1;
                var matchesFeatures = featureGroups.every(function(terms) {
                    return terms.some(function(term) {
                        return entry.featureText.indexOf(term) !== -1;
                    });
                });

                return matchesTitle && matchesFeatures;
            });

            if (settings.historyMode) {
                replaceUrl(query, state.currentPage, settings.historyMode);
            }
            render();
            return false;
        }

        function changePage(page, userInitiated) {
            var totalPages;

            initialize();
            totalPages = Math.max(1, Math.ceil(state.matches.length / state.pageSize));
            state.currentPage = Math.min(
                Math.max(1, positiveInteger(page, 1)),
                totalPages
            );
            replaceUrl(state.query, state.currentPage, userInitiated ? 'push' : 'replace');
            render();

            if (userInitiated) {
                var grid = documentObject.querySelector('.uv-product-card-area-4');
                if (grid) {
                    windowObject.scrollTo({
                        top: Math.max(0, grid.getBoundingClientRect().top + windowObject.scrollY - 100),
                        behavior: 'smooth'
                    });
                }
            }

            return false;
        }

        function searchFromInput() {
            return applySearch(state.input ? state.input.value : '', {
                page: 1,
                historyMode: 'replace'
            });
        }

        function refreshFromUrl() {
            var url = currentUrl();
            var query = normalizeQuery(url.searchParams.get('q') || '');

            if (state.input && state.input.value !== query) state.input.value = query;
            return applySearch(query, {
                page: positiveInteger(url.searchParams.get('pg'), 1),
                allowNavigation: false
            });
        }

        function bindEvents() {
            state.input.addEventListener('input', function() {
                windowObject.clearTimeout(state.timer);
                state.timer = windowObject.setTimeout(searchFromInput, SEARCH_DEBOUNCE_MS);
            });

            state.input.addEventListener('keydown', function(event) {
                if (event.key !== 'Escape') return;
                state.input.value = '';
                windowObject.clearTimeout(state.timer);
                searchFromInput();
            });

            state.form.addEventListener('submit', function(event) {
                event.preventDefault();
                windowObject.clearTimeout(state.timer);
                searchFromInput();
            });

            if (state.pagination) {
                state.pagination.addEventListener('click', function(event) {
                    var link = event.target.closest('[data-catalog-page]');
                    if (!link) return;
                    event.preventDefault();
                    changePage(link.getAttribute('data-catalog-page'), true);
                });
            }

            windowObject.addEventListener('popstate', refreshFromUrl);
        }

        function initialize() {
            var url;

            if (state.initialized) return true;

            state.input = documentObject.getElementById('course-search-input');
            state.form = state.input ? state.input.closest('form') : null;
            state.pagination = documentObject.querySelector('.box-pagination .pagination');
            state.result = documentObject.getElementById('search_result');

            if (!state.input || !state.form) return false;

            state.initialized = true;
            state.input.maxLength = MAX_QUERY_LENGTH;
            collectEntries();
            ensureEmptyState();
            syncFeatureCheckboxes();
            bindEvents();

            url = currentUrl();
            state.input.value = normalizeQuery(url.searchParams.get('q') || '');
            applySearch(state.input.value, {
                page: positiveInteger(url.searchParams.get('pg'), 1),
                allowNavigation: false
            });
            return true;
        }

        function bootstrap() {
            if (documentObject.readyState === 'loading') {
                documentObject.addEventListener('DOMContentLoaded', initialize);
            } else {
                initialize();
            }
        }

        return {
            applySearch: applySearch,
            bootstrap: bootstrap,
            changePage: changePage,
            initialize: initialize,
            refreshFromUrl: refreshFromUrl,
            searchFromInput: searchFromInput
        };
    }

    return {
        MAX_QUERY_LENGTH: MAX_QUERY_LENGTH,
        SEARCH_DEBOUNCE_MS: SEARCH_DEBOUNCE_MS,
        createController: createController,
        filterTitles: filterTitles,
        normalizeQuery: normalizeQuery,
        normalizeSearchText: normalizeSearchText,
        paginationPages: paginationPages
    };
});
