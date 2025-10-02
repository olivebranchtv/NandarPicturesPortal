# Payment Upload System Guide

## Overview
The payment upload system allows admins to upload Excel or CSV files containing payment data that automatically:
- Matches titles using fuzzy matching
- Calculates 25% distribution fees
- Updates filmmaker earnings
- Creates unassigned entries for titles that don't match

## File Format Requirements

Your Excel (.xlsx, .xls) or CSV file should have the following columns:

- **Column A**: Payment Date (Date)
- **Column B**: Gross Amount (Number)
- **Column H**: Channel/Outlet (Text, optional)
- **Column I**: Title Name (Text)

### Example:
```
| A (Date)    | B (Amount) | H (Channel)     | I (Title)         |
|-------------|------------|-----------------|-------------------|
| 2025-01-15  | 1000       | Netflix         | My Film Title     |
| 2025-01-20  | 500        | Amazon Prime    | Another Film      |
```

## How It Works

### 1. Upload Payment File
- Navigate to Admin Dashboard → Payments tab
- Click "Upload Payments"
- Select your Excel or CSV file
- Click "Parse File" to preview

### 2. Review Preview
The system will show:
- **Matched titles**: Automatically assigned to existing content
- **Unmatched titles**: Will be added to unassigned content for manual assignment
- Match scores for fuzzy matches (less than 100% indicates similar but not exact match)

### 3. Automatic Processing
When you click "Upload Payments":
- Matched payments are automatically assigned to filmmakers
- 25% distribution fee is calculated and deducted
- Filmmaker receives 75% of gross amount
- Content revenue totals are updated
- Filmmaker earnings summaries are updated

### 4. Handle Unmatched Content
Go to the "Unassigned Payments" section to:
- **Assign to Existing Title**: Link payment to an existing title in the system
- **Create New Title**: Create a new title and assign the filmmaker
- **Ignore**: Mark as not relevant

## Manual Payment Entry
You can still add individual payments manually:
- Click "Add Payment" button
- Select title and enter details
- System automatically calculates distribution fee

## Editing and Deleting Payments
In the Payment History section:
- **Edit**: Modify payment date, amount, channel, or notes
- **Delete**: Remove a payment entry (recalculates totals automatically)

## Filmmaker Dashboard
Filmmakers can view:
- Individual payment entries with dates and channels
- Payment history table showing all payments
- Gross amounts, distribution fees, and net amounts
- Total earnings summary

## Distribution Fee Calculation
- **Gross Amount**: Original payment amount from column B
- **Distribution Fee**: 25% of gross amount (automatically calculated)
- **Net to Filmmaker**: 75% of gross amount (what the filmmaker receives)

Example:
- Gross: $1,000
- Distribution Fee: $250 (25%)
- Net to Filmmaker: $750 (75%)

## Tips
- Use consistent title names in your Excel file for better matching
- The fuzzy matching algorithm allows for slight variations (e.g., "Film Title" vs "Film: Title")
- Review the preview before uploading to catch any matching issues
- Unassigned content can be processed later - no data is lost
