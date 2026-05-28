# Chemistry Lab Inventory

A static chemistry lab inventory console for tracking chemicals, cabinets, shelves, bulk imports, item details, and QR labels.

## Features

- Dashboard summary cards and active alerts
- Inventory search, filtering, add/edit/delete
- Clickable item detail pages with QR codes
- Cabinet and shelf browser
- Bulk import review flow
- Printable QR labels

## Bulk Import Columns

Paste CSV, tab-separated, or pipe-separated rows with a header like:

```csv
Chemical ID,Chemical Name,Quantity,Concentration,Storage Location,MSDS Summary
CHEM-001,Sodium Hydroxide,2 bottles,0.5 M,Cabinet E Shelf 2,Corrosive base; wear gloves
```

Equipment rows can use:

```csv
Equipment ID,Original PDF item,Equipment Name,Quantity,Size/Type,Category
EQ-001,PDF row 12,Digital Balance,2,0.01 g precision,Equipment
```

The importer also accepts the misspelled headers `Concertration` and `Original PDF itme`. After parsing, review and edit the mapped fields before saving.

## Publish With GitHub Pages

This is a static site. Publish the repository with GitHub Pages using the `main` branch and root folder.

## Shared Inventory Database

This site uses Supabase for shared inventory across devices. Run `supabase-setup.sql` once in the Supabase SQL Editor to create the `inventory_items` table and public policies.
