import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Signal — Your job inbox',description:'A personal design-job inbox. Check the source, understand the fit, and track your next move.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
