import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  HOMEPAGE_SECTIONS,
  getHomepagePathBySectionId,
  getHomepageSectionByPath,
} from '../utils/homepageSections'

type UseSectionRoutingOptions = {
  disabled?: boolean
}

export function scrollToHomepageSection(sectionId: string, behavior: ScrollBehavior = 'smooth') {
  const el = document.getElementById(sectionId)
  if (!el) return

  const topBarHeight = document.querySelector<HTMLElement>('.public-topbar')?.offsetHeight ?? 0
  const top = el.getBoundingClientRect().top + window.scrollY - topBarHeight
  window.scrollTo({ top: Math.max(0, top), behavior })
}

export function useSectionRouting({ disabled = false }: UseSectionRoutingOptions = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const routeScrollInProgress = useRef(false)
  const routeScrollTargetId = useRef<string | null>(null)
  const observedPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (disabled) return

    if (observedPathRef.current === location.pathname) {
      observedPathRef.current = null
      return
    }

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
    if (disabled) return

    const sectionElements = HOMEPAGE_SECTIONS
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (!sectionElements.length) return

    let frameId: number | null = null
    const updateActiveSection = () => {
      frameId = null
      const topBarHeight = document.querySelector<HTMLElement>('.public-topbar')?.offsetHeight ?? 0
      const anchorY = topBarHeight + window.innerHeight * 0.25
      let activeSection = sectionElements[0]

      for (const section of sectionElements) {
        if (section.getBoundingClientRect().top > anchorY) break
        activeSection = section
      }

      if (routeScrollInProgress.current) {
        if (activeSection.id !== routeScrollTargetId.current) return
        routeScrollInProgress.current = false
        routeScrollTargetId.current = null
      }

      const nextPath = getHomepagePathBySectionId(activeSection.id)
      if (!nextPath || location.pathname === nextPath) return

      observedPathRef.current = nextPath
      navigate(`${nextPath}${location.search}`, { replace: true, preventScrollReset: true })
    }

    const scheduleUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(updateActiveSection)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [disabled, location.pathname, location.search, navigate])
}
