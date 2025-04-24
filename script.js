<script>
document.addEventListener('DOMContentLoaded', function() {
    // Initialize local storage if empty
    if (!localStorage.getItem('warrantyProducts')) {
        localStorage.setItem('warrantyProducts', JSON.stringify([]));
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
    
    // Configuration - REPLACE WITH YOUR ACTUAL VALUES
    const CONFIG = {
        clientId: '80785123608-hebadvt7k7pcjnthnvkbtodc9i328le0.apps.googleusercontent.com',
        spreadsheetId: '1okznadJPiXLygebie8jLStKPF6WUoDsrqqDAFogLS7o',
        apiKey: 'AIzaSyBtIb_OEZXjsex6BlPZsk35ISO3CVKV2io'
    };

    // Global token variable
    let accessToken = null;

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

    // Initialize Google Identity Services
    initGoogleIdentity();

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
        
        // Set icon based on type
        const icon = toast.querySelector('i');
        icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // Form Submission
    function handleFormSubmit(e) {
        e.preventDefault();
        
        // Get form values
        const customerName = document.getElementById('customerName').value;
        const product = document.getElementById('product').value;
        const saleDate = document.getElementById('saleDate').value;
        const warrantyPeriod = parseInt(document.getElementById('warrantyPeriod').value);
        
        // Calculate expiry date
        const saleDateObj = new Date(saleDate);
        const expiryDateObj = new Date(saleDateObj);
        expiryDateObj.setMonth(saleDateObj.getMonth() + warrantyPeriod);
        
        // Create product object
        const productData = {
            id: Date.now().toString(),
            customerName,
            product,
            saleDate,
            formattedSaleDate: formatDate(saleDateObj),
            warrantyPeriod,
            expiryDate: expiryDateObj.toISOString().split('T')[0],
            formattedExpiryDate: formatDate(expiryDateObj),
            status: getWarrantyStatus(expiryDateObj)
        };
        
        // Save to local storage
        const products = JSON.parse(localStorage.getItem('warrantyProducts'));
        products.push(productData);
        localStorage.setItem('warrantyProducts', JSON.stringify(products));
        
        // Show success message
        showToast('Product registered successfully!', 'success');
        
        // Reset form
        this.reset();
        document.getElementById('warrantyPeriod').value = '12';
        
        // Reload table
        loadProductsTable();
    }

    // Search Functionality
    function handleSearch() {
        const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
        loadProductsTable(searchTerm);
    }

    // Load Products Table
    function loadProductsTable(searchTerm = '') {
        const products = JSON.parse(localStorage.getItem('warrantyProducts'));
        const filteredProducts = searchTerm 
            ? products.filter(p => 
                p.customerName.toLowerCase().includes(searchTerm) || 
                p.product.toLowerCase().includes(searchTerm))
            : products;
        
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
            
            // Determine status
            const expiryDate = new Date(product.expiryDate);
            const status = getWarrantyStatus(expiryDate);
            let statusBadge = '';
            
            if (status === 'active') {
                statusBadge = '<span class="status status-active">Active</span>';
            } else if (status === 'warning') {
                statusBadge = '<span class="status status-warning">Expiring Soon</span>';
            } else {
                statusBadge = '<span class="status status-expired">Expired</span>';
            }
            
            row.innerHTML = `
                <td>${product.customerName}</td>
                <td>${product.product}</td>
                <td>${product.formattedSaleDate}</td>
                <td>${product.warrantyPeriod} months</td>
                <td>${product.formattedExpiryDate}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-secondary btn-sm delete-btn" data-id="${product.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (confirm('Are you sure you want to delete this product?')) {
                    const productId = this.getAttribute('data-id');
                    let products = JSON.parse(localStorage.getItem('warrantyProducts'));
                    products = products.filter(p => p.id !== productId);
                    localStorage.setItem('warrantyProducts', JSON.stringify(products));
                    loadProductsTable(document.getElementById('searchInput').value.trim().toLowerCase());
                    showToast('Product deleted successfully!', 'success');
                }
            });
        });
    }

    // CSV Export
    function exportToCsv() {
        const products = JSON.parse(localStorage.getItem('warrantyProducts'));
        let csvContent = "Customer Name,Product,Sale Date,Warranty Period,Expiry Date,Status\n";
        
        products.forEach(product => {
            csvContent += `"${product.customerName}","${product.product}","${product.saleDate}","${product.warrantyPeriod}","${product.expiryDate}","${getWarrantyStatus(new Date(product.expiryDate))}"\n`;
        });
        
        downloadFile('warranty-data.csv', csvContent);
        showToast('Data exported to CSV file!', 'success');
    }

    // CSV Import
    function handleCsvImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const csvData = e.target.result;
                const products = parseCsv(csvData);
                
                if (products && products.length > 0) {
                    localStorage.setItem('warrantyProducts', JSON.stringify(products));
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
            
            if (values.length >= 5) {
                const saleDate = new Date(values[2]);
                const warrantyPeriod = parseInt(values[3]);
                const expiryDate = new Date(saleDate);
                expiryDate.setMonth(saleDate.getMonth() + warrantyPeriod);
                
                products.push({
                    id: Date.now().toString() + i,
                    customerName: values[0],
                    product: values[1],
                    saleDate: values[2],
                    formattedSaleDate: formatDate(saleDate),
                    warrantyPeriod: warrantyPeriod,
                    expiryDate: expiryDate.toISOString().split('T')[0],
                    formattedExpiryDate: formatDate(expiryDate),
                    status: getWarrantyStatus(expiryDate)
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

    // Google Identity Services Integration
    function initGoogleIdentity() {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
    }

    function handleAuthClick() {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    authModal.style.display = 'none';
                    showToast('Successfully authenticated with Google', 'success');
                } else {
                    showToast('Authentication failed', 'error');
                }
            },
            error_callback: (error) => {
                console.error('Google auth error:', error);
                showToast('Authentication error', 'error');
            }
        });
        client.requestAccessToken();
    }

    async function saveToGoogleSheets() {
        if (!accessToken) {
            authModal.style.display = 'block';
            return;
        }
        
        const products = JSON.parse(localStorage.getItem('warrantyProducts'));
        const values = products.map(p => [
            p.customerName,
            p.product,
            p.saleDate,
            p.warrantyPeriod,
            p.expiryDate,
            p.status
        ]);
        
        // Add headers
        values.unshift(['Customer Name', 'Product', 'Sale Date', 'Warranty Period', 'Expiry Date', 'Status']);
        
        try {
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
        } catch (error) {
            console.error('Error saving to Google Sheets:', error);
            showToast('Error saving to Google Sheets', 'error');
            
            // Token might be expired, clear it
            accessToken = null;
        }
    }

    async function loadFromGoogleSheets() {
        if (!accessToken) {
            authModal.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/A2:F`,
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
            
            const products = values.map(row => {
                const saleDate = new Date(row[2]);
                const expiryDate = new Date(row[4]);
                
                return {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    customerName: row[0],
                    product: row[1],
                    saleDate: row[2],
                    formattedSaleDate: formatDate(saleDate),
                    warrantyPeriod: parseInt(row[3]),
                    expiryDate: row[4],
                    formattedExpiryDate: formatDate(expiryDate),
                    status: getWarrantyStatus(expiryDate)
                };
            });
            
            localStorage.setItem('warrantyProducts', JSON.stringify(products));
            loadProductsTable();
            showToast('Data loaded from Google Sheets!', 'success');
        } catch (error) {
            console.error('Error loading from Google Sheets:', error);
            showToast('Error loading from Google Sheets', 'error');
            
            // Token might be expired, clear it
            accessToken = null;
        }
    }

    // Add export CSV button event listener
    document.getElementById('exportCsv').addEventListener('click', exportToCsv);
});