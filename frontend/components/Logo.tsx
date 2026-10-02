'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

export function Logo({ size = 'md', showTagline = true }: { size?: 'sm' | 'md' | 'lg'; showTagline?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const dims = size === 'sm' ? 32 : size === 'lg' ? 56 : 40;
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div
        className="relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-mint/10 border border-primary/10 group-hover:scale-105 transition-transform duration-300"
        style={{ width: dims, height: dims }}
      >
        {!imgError ? (
          <Image
            src="/logo.png"
            alt="ChatNexa"
            width={dims}
            height={dims}
            className="object-contain w-full h-full"
            onError={() => setImgError(true)}
            priority
          />
        ) : (
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-primary to-mint grid place-items-center shadow-lg">
            <MessageSquare className="w-1/2 h-1/2 text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="flex flex-col leading-none">
        <span className={`${textSize} font-extrabold tracking-tight bg-gradient-to-r from-ink via-primary to-blue-600 bg-clip-text text-transparent`}>
          ChatNexa
        </span>
        {showTagline && size !== 'sm' && (
          <span className="text-[9px] font-bold text-primary/70 uppercase tracking-[0.15em] mt-0.5">
            AI Sales Platform
          </span>
        )}
      </div>
    </Link>
  );
}

export default Logo;
