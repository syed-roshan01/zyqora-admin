import './globals.css';

export const metadata = {
    title: 'Zyqora Admin',
    description: 'License Management Panel',
    icons: {
        icon: [
            { url: '/favicon_io/favicon.ico' },
            { url: '/favicon_io/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
            { url: '/favicon_io/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        ],
        apple: '/favicon_io/apple-touch-icon.png',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
