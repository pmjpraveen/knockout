import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';
import type { PopProps, RevealProps, StaggerProps } from '@/components/Motion';

// Web implementation of the motion vocabulary on GSAP. React Native Web hands out real DOM nodes as refs.
// Every tween clears only the opacity and transform it set when done; clearing everything would also wipe inline
// layout styles that React Native Web puts on the element.

const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const asElement = (node: unknown) => node as HTMLElement | null;

export function Reveal({ children, delay = 0, y = 12, style }: RevealProps) {
  const ref = useRef<View>(null);

  useLayoutEffect(() => {
    const element = asElement(ref.current);
    if (!element || reduced()) return;
    const tween = gsap.from(element, { opacity: 0, y, duration: 0.4, delay, ease: 'power3.out', clearProps: 'opacity,transform' });
    return () => { tween.kill(); };
  }, []);

  return <View ref={ref} style={style}>{children}</View>;
}

export function Stagger({ children, each = 0.05, max = 10, y = 12, style }: StaggerProps) {
  const ref = useRef<View>(null);

  useLayoutEffect(() => {
    const element = asElement(ref.current);
    if (!element || reduced()) return;
    const tween = gsap.from(Array.from(element.children).slice(0, max), { opacity: 0, y, duration: 0.4, ease: 'power3.out', stagger: each, clearProps: 'opacity,transform' });
    return () => { tween.kill(); };
  }, []);

  return <View ref={ref} style={style}>{children}</View>;
}

export function Pop({ trigger, children, style }: PopProps) {
  const ref = useRef<View>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const element = asElement(ref.current);
    if (!element || reduced()) return;
    const tween = gsap.fromTo(element, { scale: 1.15 }, { scale: 1, duration: 0.35, ease: 'back.out(2.5)', clearProps: 'transform' });
    return () => { tween.kill(); };
  }, [trigger]);

  return <View ref={ref} style={style}>{children}</View>;
}
