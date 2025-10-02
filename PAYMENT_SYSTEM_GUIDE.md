# Complete Payment & Admin System Guide

## Overview
The platform provides a complete payment management system for admins and filmmakers including:
- Excel/CSV payment upload with automatic matching
- Filmmaker payment request workflow ($25 minimum)
- Admin approval and payment tracking
- Comprehensive titles and filmmaker management
- Real-time dashboard views for verification

## Admin Features

### 1. View Filmmaker Dashboards
- Navigate to **Admin Dashboard → Filmmakers** tab
- Click "View Dashboard" next to any filmmaker
- See their complete financial information:
  - All titles
  - Payment history
  - Total earnings and available balance
  - PayPal/Venmo details
  - Contact information

### 2. Titles Management
- Navigate to **Admin Dashboard → Titles** tab
- View all titles in the system
- Edit title information and reassign to different filmmakers
- Delete titles if needed
- Change distribution percentages per title

### 3. Payment Request Management
- Navigate to **Admin Dashboard → Requests** tab
- View all filmmaker payment requests
- **Approve**: Filmmakers are notified to expect payment within 14 days
- **Mark as Paid**: Select PayPal or Venmo as payment method
- **Reject**: Decline payment requests with notification
- Track payment status: Pending → Approved → Paid

### 4. Payment Upload System
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

## Filmmaker Features

### Payment Requests
Filmmakers can request payments once they reach $25:
1. Navigate to Filmmaker Dashboard
2. Click "Request Payment" button (visible when balance ≥ $25)
3. Enter desired amount (between $25 and available balance)
4. Submit request
5. **Notice**: "Expect payment within 14 days from time of request"
6. Track request status in dashboard

### Request Status Flow
- **Pending**: Submitted, awaiting admin review
- **Approved**: Admin approved, payment processing within 14 days
- **Paid**: Payment completed via PayPal or Venmo
- **Rejected**: Request declined

### Dashboard Views
Filmmakers can view:
- Individual payment entries with dates and channels
- Payment history table showing all payments
- Gross amounts, distribution fees, and net amounts
- Total earnings summary
- Available balance for withdrawal
- Payment request history and status

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
