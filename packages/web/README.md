# PulseCal SecureBand Web Dashboard

Next.js dashboard for monitoring and managing PulseCal SecureBand devices and inmates.

## Features

- ✅ Next.js 14 App Router
- ✅ Tailwind CSS + shadcn/ui components
- ✅ Responsive layout with sidebar navigation
- ✅ Live Overview dashboard
- ✅ Inmate management
- ✅ Device health monitoring
- ✅ Alert management

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with sidebar
│   ├── page.tsx           # Live Overview (home)
│   ├── inmates/           # Inmate list page
│   ├── devices/           # Device health page
│   └── alerts/            # Alerts page
├── components/
│   ├── ui/                # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   └── layout/            # Layout components
│       ├── sidebar.tsx
│       └── header.tsx
└── lib/
    └── utils.ts           # Utility functions
```

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install

# Or from root
pnpm install --filter @pulsecal/web
```

### Development

```bash
# Start development server
pnpm dev

# The app will be available at http://localhost:3000
```

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Pages

### Live Overview (`/`)
- Real-time statistics dashboard
- Active devices count
- Monitored inmates count
- Open alerts summary
- Recent activity feed

### Inmates (`/inmates`)
- List of all inmates
- Search and filter functionality
- Inmate device assignments
- Status management

### Device Health (`/devices`)
- Device status overview
- Battery level monitoring
- Connection status
- Device maintenance tracking
- Filter by status (active, inactive, maintenance)

### Alerts (`/alerts`)
- Alert management dashboard
- Filter by status (open, acknowledged, resolved)
- Alert severity indicators
- Alert history

## Component Library

Built with shadcn/ui components:

- **Button** - Various button styles and sizes
- **Card** - Container component for content sections
- **Badge** - Status indicators with variants (default, success, warning, critical)
- **Tabs** - Tabbed interface for organizing content
- **Input** - Form input fields
- **Label** - Form labels

## Routing Strategy

Next.js App Router is used with file-based routing:

- `/` - Live Overview (home page)
- `/inmates` - Inmate list and management
- `/devices` - Device health monitoring
- `/alerts` - Alert management

All routes share the same layout with sidebar navigation.

## Styling

- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **CSS Variables** - Theming support (light/dark mode ready)

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_SERVICES_URL=http://localhost:8000
```

## Future Enhancements

- [ ] Real-time data fetching from API
- [ ] Data visualization (charts, graphs)
- [ ] Real-time updates (WebSocket/SSE)
- [ ] Authentication and authorization
- [ ] Advanced filtering and search
- [ ] Export functionality
- [ ] Dark mode toggle
- [ ] Responsive mobile navigation
