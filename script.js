document.addEventListener('DOMContentLoaded', function() {
        // Initialize local storage if empty
        if (!localStorage.getItem('warrantyProducts')) {
            localStorage.setItem('warrantyProducts', JSON.stringify([]));
        }
        if (!localStorage.getItem('deletedProducts')) {
            localStorage.setItem('deletedProducts', JSON.stringify([]));
        }
        
        // Configuration
        const CONFIG = {
            clientId: '80785123608-hebadvt7k7pcjnthnvkbtodc9i328le0.apps.googleusercontent.com',
            spreadsheetId: '1okznadJPiXLygebie8jLStKPF6WUoDsrqqDAFogLS7o',
            apiKey: 'AIzaSyBtIb_OEZXjsex6BlPZsk35ISO3CVKV2io'
        };

        // Global variables
        let accessToken = null;
        let lastSavedHash = '';

        // Event Listeners
        registerForm.addEventListener('submit', handleFormSubmit);
        searchBtn.addEventListener('click', handleSearch);
        importCsvBtn.addEventListener('click', () => csvFileInput.click());
        csvFileInput.addEventListener('change', handleCsvImport);
        saveToSheetsBtn.addEventListener('click', saveToGoogleSheets);
        loadFromSheetsBtn.addEventListener('click', loadFromGoogleSheets);
        authButton.addEventListener('click', handleAuthClick);
        closeModal.addEventListener('click', () => authModal.style.display = 'none');

        // Load initial data
        loadProductsTable();
        checkAuthOnStartup();

        // Helper Functions
        function formatDate(date) {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return date.toLocaleDateString(undefined, options);
        }

        function getWarrantyStatus(expiryDate) {
            const today = new Date();
            const timeDiff = expiryDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff <= 0) return 'expired';
            if (daysDiff <= 30) return 'warning';
            return 'active';
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toastMessage');
            
            toastMessage.textContent = message;
            toast.className = `toast ${type}`;
            toast.style.display = 'flex';
            
            const icon = toast.querySelector('i');
            icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
            
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }

        function generateDataHash() {
            const products = JSON.parse(localStorage.getItem('warrantyProducts'));
            const deleted = JSON.parse(localStorage.getItem('deletedProducts'));
            return JSON.stringify(products) + JSON.stringify(deleted);
        }

        // Form Submission
        function handleFormSubmit(e) {
            e.preventDefault();
            
            const customerName = document.getElementById('customerName').value;
            const product = document.getElementById('product').value;
            const saleDate = document.getElementById('saleDate').value;
            const warrantyPeriod = parseInt(document.getElementById('warrantyPeriod').value);
            
            // Check for duplicate entry
            const products = JSON.parse(localStorage.getItem('warrantyProducts'));
            const isDuplicate = products.some(p => 
                p.customerName === customerName && 
                p.product === product && 
                p.saleDate === saleDate
            );
            
            if (isDuplicate) {
                showToast('This product is already registered', 'error');
                return;
            }
            
            const saleDateObj = new Date(saleDate);
            const expiryDateObj = new Date(saleDateObj);
            expiryDateObj.setMonth(saleDateObj.getMonth() + warrantyPeriod);
            
            const productData = {
                id: Date.now().toString(),
                customerName,
                product,
                saleDate,
                formattedSaleDate: formatDate(saleDateObj),
                warrantyPeriod,
                expiryDate: expiryDateObj.toISOString().split('T')[0],
                formattedExpiryDate: formatDate(expiryDateObj),
                status: getWarrantyStatus(expiryDateObj),
                isDeleted: false
            };
            
            products.push(productData);
            localStorage.setItem('warrantyProducts', JSON.stringify(products));
            
            showToast('Product registered successfully!', 'success');
            this.reset();
            loadProductsTable();
            autoSaveToSheets();
        }
        // DOM Elements
        const registerForm = document.getElementById('registerForm');
        const searchBtn = document.getElementById('searchBtn');
        const importCsvBtn = document.getElementById('importCsv');
        const csvFileInput = document.getElementById('csvFileInput');
        const saveToSheetsBtn = document.getElementById('saveToSheets');
        const loadFromSheetsBtn = document.getElementById('loadFromSheets');
        const authModal = document.getElementById('authModal');
        const authButton = document.getElementById('authButton');
        const closeModal = document.querySelector('.close');

        function loadProductsTable(searchTerm = '') {
            const products = JSON.parse(localStorage.getItem('warrantyProducts'));
            const deletedProducts = JSON.parse(localStorage.getItem('deletedProducts'));
            const allProducts = [...products, ...deletedProducts];
            
            const filteredProducts = searchTerm 
                ? allProducts.filter(p => 
                    p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    p.product.toLowerCase().includes(searchTerm.toLowerCase()))
                : allProducts;
            
            const tableBody = document.getElementById('productsTableBody');
            tableBody.innerHTML = '';
            
            if (filteredProducts.length === 0) {
                document.getElementById('emptyProductsState').style.display = 'block';
                return;
            } else {
                document.getElementById('emptyProductsState').style.display = 'none';
            }
            
            filteredProducts.forEach(product => {
                const row = document.createElement('tr');
                if (product.isDeleted) {
                    row.classList.add('deleted-row');
                }
                
                const expiryDate = new Date(product.expiryDate);
                const status = product.isDeleted ? 'deleted' : getWarrantyStatus(expiryDate);
                let statusBadge = '';
                
                if (status === 'active') {
                    statusBadge = '<span class="status status-active">Active</span>';
                } else if (status === 'warning') {
                    statusBadge = '<span class="status status-warning">Expiring Soon</span>';
                } else if (status === 'expired') {
                    statusBadge = '<span class="status status-expired">Expired</span>';
                } else {
                    statusBadge = '<span class="status status-deleted">Deleted</span>';
                }
                
                row.innerHTML = `
                    <td>${product.customerName}</td>
                    <td>${product.product}</td>
                    <td>${product.formattedSaleDate}</td>
                    <td>${product.warrantyPeriod} months</td>
                    <td>${product.formattedExpiryDate}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${!product.isDeleted ? `
                        <button class="btn btn-secondary btn-sm delete-btn" data-id="${product.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                        ` : ''}
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const productId = this.getAttribute('data-id');
                    let products = JSON.parse(localStorage.getItem('warrantyProducts'));
                    let deletedProducts = JSON.parse(localStorage.getItem('deletedProducts'));
                    
                    const productIndex = products.findIndex(p => p.id === productId);
                    if (productIndex !== -1) {
                        const deletedProduct = products[productIndex];
                        deletedProduct.isDeleted = true;
                        deletedProducts.push(deletedProduct);
                        products.splice(productIndex, 1);
                        
                        localStorage.setItem('warrantyProducts', JSON.stringify(products));
                        localStorage.setItem('deletedProducts', JSON.stringify(deletedProducts));
                        
                        loadProductsTable(document.getElementById('searchInput').value.trim());
                        showToast('Product moved to deleted items', 'success');
                        autoSaveToSheets();
                    }
                });
            });
        }

        function exportToCsv() {
            const products = JSON.parse(localStorage.getItem('warrantyProducts'));
            const deletedProducts = JSON.parse(localStorage.getItem('deletedProducts'));
            const allProducts = [...products, ...deletedProducts];
            
            let csvContent = "Customer Name,Product,Sale Date,Warranty Period,Expiry Date,Status,Deleted\n";
            
            allProducts.forEach(product => {
                const status = product.isDeleted ? 'deleted' : getWarrantyStatus(new Date(product.expiryDate));
                csvContent += `"${product.customerName}","${product.product}","${product.saleDate}",` +
                             `"${product.warrantyPeriod}","${product.expiryDate}","${status}","${product.isDeleted}"\n`;
            });
            
            downloadFile('warranty-data.csv', csvContent);
            showToast('Data exported to CSV file!', 'success');
        }

        function handleCsvImport(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csvData = e.target.result;
                    const products = parseCsv(csvData);
                    
                    if (products && products.length > 0) {
                        localStorage.setItem('warrantyProducts', JSON.stringify(products.filter(p => !p.isDeleted)));
                        localStorage.setItem('deletedProducts', JSON.stringify(products.filter(p => p.isDeleted)));
                        showToast(`${products.length} products imported successfully!`, 'success');
                        loadProductsTable();
                    }
                } catch (error) {
                    showToast('Error importing CSV file. Please check the format.', 'error');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        }

        function parseCsv(csv) {
            const lines = csv.split('\n');
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const products = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                                     .map(v => v.replace(/^"|"$/g, '').trim());
                
                if (values.length >= 6) {
                    const saleDate = new Date(values[2]);
                    const warrantyPeriod = parseInt(values[3]);
                    const expiryDate = new Date(saleDate);
                    expiryDate.setMonth(saleDate.getMonth() + warrantyPeriod);
                    const isDeleted = values[5].toLowerCase() === 'true' || values[5] === 'deleted';
                    
                    products.push({
                        id: Date.now().toString() + i,
                        customerName: values[0],
                        product: values[1],
                        saleDate: values[2],
                        formattedSaleDate: formatDate(saleDate),
                        warrantyPeriod: warrantyPeriod,
                        expiryDate: expiryDate.toISOString().split('T')[0],
                        formattedExpiryDate: formatDate(expiryDate),
                        status: getWarrantyStatus(expiryDate),
                        isDeleted: isDeleted
                    });
                }
            }
            
            return products;
        }

        function downloadFile(filename, content) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function checkAuthOnStartup() {
            // Check if we have a saved token in localStorage
            const savedToken = localStorage.getItem('googleAuthToken');
            if (savedToken) {
                accessToken = savedToken;
                // Verify token is still valid
                verifyToken(savedToken).then(isValid => {
                    if (!isValid) {
                        authModal.style.display = 'block';
                    } else {
                        // Auto-load data after 1 month
                        const lastLoad = localStorage.getItem('lastSheetsLoad');
                        if (!lastLoad || (Date.now() - parseInt(lastLoad)) > 30 * 24 * 60 * 60 * 1000) {
                            loadFromGoogleSheets();
                        }
                    }
                });
            } else {
                authModal.style.display = 'block';
            }
        }

        function verifyToken(token) {
            return fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token)
                .then(response => response.ok)
                .catch(() => false);
        }

        function handleAuthClick() {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.clientId,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                prompt: 'consent',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        accessToken = tokenResponse.access_token;
                        localStorage.setItem('googleAuthToken', accessToken);
                        authModal.style.display = 'none';
                        showToast('Successfully authenticated with Google', 'success');
                        loadFromGoogleSheets();
                    }
                },
                error_callback: (error) => {
                    console.error('Google auth error:', error);
                    showToast('Authentication error', 'error');
                }
            });
            client.requestAccessToken();
        }

        function autoSaveToSheets() {
            const currentHash = generateDataHash();
            if (currentHash !== lastSavedHash && accessToken) {
                saveToGoogleSheets();
                lastSavedHash = currentHash;
            }
        }

        async function saveToGoogleSheets() {
            if (!accessToken) {
                authModal.style.display = 'block';
                return;
            }
            
            const products = JSON.parse(localStorage.getItem('warrantyProducts'));
            const deletedProducts = JSON.parse(localStorage.getItem('deletedProducts'));
            const allProducts = [...products, ...deletedProducts];
            
            // Clear existing sheet first
            try {
                await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/A1:Z1000?valueInputOption=RAW`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            range: 'A1:Z1000',
                            majorDimension: 'ROWS',
                            values: []
                        })
                    }
                );
                
                // Add headers and data
                const values = allProducts.map(p => [
                    p.customerName,
                    p.product,
                    p.saleDate,
                    p.warrantyPeriod,
                    p.expiryDate,
                    p.isDeleted ? 'Deleted' : getWarrantyStatus(new Date(p.expiryDate)),
                    p.isDeleted ? 'TRUE' : 'FALSE'
                ]);
                
                values.unshift(['Customer Name', 'Product', 'Sale Date', 'Warranty Period', 'Expiry Date', 'Status', 'Deleted']);
                
                const response = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/A1:append?valueInputOption=RAW`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            range: 'A1',
                            majorDimension: 'ROWS',
                            values: values
                        })
                    }
                );
                
                if (!response.ok) throw new Error(await response.text());
                
                showToast('Data saved to Google Sheets!', 'success');
                localStorage.setItem('lastSheetsSave', Date.now().toString());
            } catch (error) {
                console.error('Error saving to Google Sheets:', error);
                showToast('Error saving to Google Sheets', 'error');
                accessToken = null;
                localStorage.removeItem('googleAuthToken');
            }
        }

        async function loadFromGoogleSheets() {
            if (!accessToken) {
                authModal.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/A2:G`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }
                );
                
                if (!response.ok) throw new Error(await response.text());
                
                const data = await response.json();
                const values = data.values;
                
                if (!values || values.length === 0) {
                    showToast('No data found in Google Sheets', 'error');
                    return;
                }
                
                const products = [];
                const deletedProducts = [];
                
                values.forEach(row => {
                    const saleDate = new Date(row[2]);
                    const warrantyPeriod = parseInt(row[3]);
                    const expiryDate = new Date(row[4]);
                    const isDeleted = row[6] === 'TRUE';
                    
                    const productData = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        customerName: row[0],
                        product: row[1],
                        saleDate: row[2],
                        formattedSaleDate: formatDate(saleDate),
                        warrantyPeriod: warrantyPeriod,
                        expiryDate: row[4],
                        formattedExpiryDate: formatDate(expiryDate),
                        status: getWarrantyStatus(expiryDate),
                        isDeleted: isDeleted
                    };
                    
                    if (isDeleted) {
                        deletedProducts.push(productData);
                    } else {
                        products.push(productData);
                    }
                });
                
                localStorage.setItem('warrantyProducts', JSON.stringify(products));
                localStorage.setItem('deletedProducts', JSON.stringify(deletedProducts));
                loadProductsTable();
                showToast('Data loaded from Google Sheets!', 'success');
                localStorage.setItem('lastSheetsLoad', Date.now().toString());
            } catch (error) {
                console.error('Error loading from Google Sheets:', error);
                showToast('Error loading from Google Sheets', 'error');
                accessToken = null;
                localStorage.removeItem('googleAuthToken');
            }
        }

        // Initialize export CSV button
        document.getElementById('exportCsv').addEventListener('click', exportToCsv);
    });
