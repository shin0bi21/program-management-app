import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  HOMEPAGE_SECTIONS,
  getHomepagePathBySectionId,
  getHomepageSectionByPath,
} from '../homepageSections'

type UseSectionRoutingOptions = {
  disabled?: boolean
}

function scrollToHomepageSection(sectionId: string, behavior: ScrollBehavior = 'smooth') {
  const el = document.getElementById(sectionId)
  if (!el) return

  const topBarHeight = document.querySelector<HTMLElement>('.public-topbar')?.offsetHeight ?? 0
  const top = el.getBoundingClientRect().top + window.scrollY - topBarHeight
  window.scrollTo({ top: Math.max(0, top), behavior })
}

export function useSectionRouting({ disabled = false }: UseSectionRoutingOptions = {}) {
  const location = useLocation()
  const routeScrollInProgress = useRef(false)
  const routeScrollTargetId = useRef<string | null>(null)

  useEffect(() => {
    if (disabled) return

    const section = getHomepageSectionByPath(location.pathname)
    if (!section) return
    if (section.id === 'home' && window.scrollY <= 0) return

    routeScrollInProgress.current = true
    routeScrollTargetId.current = section.id

    const frameId = window.requestAnimationFrame(() => {
      scrollToHomepageSection(section.id)
    })
    const timeoutId = window.setTimeout(() => {
      routeScrollInProgress.current = false
      routeScrollTargetId.current = null
    }, 2000)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
      routeScrollInProgress.current = false
      routeScrollTargetId.current = null
    }
  }, [disabled, location.pathname])

  useEffect(() => {
    if (disabled || typeof IntersectionObserver === 'undefined') return

    const sectionElements = HOMEPAGE_SECTIONS
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (!sectionElements.length) return

    const observer = new IntersectionObserver((entries) => {
      if (routeScrollInProgress.current) {
        const reachedRouteTarget = entries.some((entry) => (
          entry.isIntersecting && entry.target.id === routeScrollTargetId.current
        ))

        if (!reachedRouteTarget) return

        routeScrollInProgress.current = false
        routeScrollTargetId.current = null
      }

      const visibleEntries = entries.filter((entry) => entry.isIntersecting)
      if (!visibleEntries.length) return

      const activeEntry = visibleEntries.reduce((best, entry) => (
        entry.intersectionRatio > best.intersectionRatio ? entry : best
      ))
      const nextPath = getHomepagePathBySectionId(activeEntry.target.id)
      if (!nextPath || window.location.pathname === nextPath) return

      window.history.replaceState(window.history.state, '', `${nextPath}${window.location.search}`)
    }, {
      rootMargin: '-30% 0px -55% 0px',
      threshold: [0, 0.2, 0.5, 0.8, 1],
    })

    sectionElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [disabled])
}
