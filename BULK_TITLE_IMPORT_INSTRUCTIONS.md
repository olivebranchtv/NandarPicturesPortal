# Bulk Title Import Instructions

## How to Import Titles from Your Excel File

### Step 1: Extract Title Names from Excel
1. Open your payment Excel file
2. Go to **Column I** (Title Name)
3. Select all the title names (from row 2 onwards, skip the header)
4. Copy them (Ctrl+C or Cmd+C)

### Step 2: Use the Bulk Import Feature
1. Log in as admin
2. Navigate to **Admin Dashboard → Titles** tab
3. Click the **"Bulk Import"** button (top right)
4. Paste the title names into the text area (one per line)
5. Click **"Import Titles"**

### What Happens During Import
- Each title is created with:
  - **Type**: Movie
  - **Status**: Approved
  - **Revenue**: $0 (will be updated when payments are processed)
- Duplicate titles are automatically skipped
- You'll see a summary of successful imports and any errors

### Step 3: Assign Filmmakers (Optional)
After importing:
1. Go to the **Titles** tab
2. Click **"Edit"** next to any title
3. Select the filmmaker from the dropdown
4. Save changes

### Step 4: Upload Payment Data
Once titles are created:
1. Go to **Payments** tab
2. Click **"Upload Payments"**
3. Upload your Excel file
4. The system will now match payments to the newly created titles

## Tips
- Import all titles first before uploading payment data
- The fuzzy matching will work better when titles already exist
- You can always edit title details later
- Titles without assigned filmmakers will show "No filmmaker assigned" in red

## Troubleshooting
- **"Already exists" error**: Title is already in the database (this is safe to ignore)
- **Empty lines**: The system automatically skips empty lines
- **Special characters**: All title names with special characters are supported

## Example Title List Format
```
THE RED RESURRECTION
Good Grief
My Documentary Title
Another Movie Name
Film Title Here
```

Just paste them one per line and click Import!
