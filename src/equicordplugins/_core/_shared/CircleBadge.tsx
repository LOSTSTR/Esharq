/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Tooltip } from "@webpack/common";
import type { JSX } from "react";

interface CircleBadgeProps {
    /** Pixel size of the badge (width = height). */
    size: number;
    /** Image shown inside the circle — a base64 data: URI or a URL. */
    image: string;
    /** Outer ring (circle) color. */
    ring: string;
    /** Tooltip text shown on hover, also used as the accessible label. */
    tooltip: string;
    /** CSS class carrying this badge's own glow/animation (defined in its styles.css). */
    className: string;
}

/**
 * Shared circular badge drawing: a colored ring with a round image inside,
 * wrapped in a hover tooltip. Every Esharq badge draws the exact same way —
 * only the image, ring color, tooltip and CSS class differ. Each badge keeps
 * its own data and styling and just calls this one component to draw itself,
 * so the drawing recipe lives in a single place instead of being copied.
 *
 * Drawn with a plain HTML <img> (ring = colored padding around it) rather than
 * an SVG <image>, because SVG <image href> does not reliably render data: URIs
 * across Discord's render contexts, which left the badges showing as broken
 * images. An <img> renders both data: URIs and URLs everywhere.
 */
export function CircleBadge({ size, image, ring, tooltip, className }: CircleBadgeProps): JSX.Element {
    // Ring thickness scales with size, matching the previous SVG ring proportions.
    const ringWidth = Math.max(1, Math.round(size / 12));
    return (
        <ErrorBoundary noop>
            <Tooltip text={tooltip} position="top">
                {({ onMouseEnter, onMouseLeave }) => (
                    <div
                        className={className}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        style={{
                            width: size,
                            height: size,
                            borderRadius: "50%",
                            backgroundColor: ring,
                            padding: ringWidth,
                            boxSizing: "border-box"
                        }}
                        role="img"
                        aria-label={tooltip}
                    >
                        <img
                            src={image}
                            alt=""
                            width={size - ringWidth * 2}
                            height={size - ringWidth * 2}
                            style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                objectFit: "cover",
                                display: "block"
                            }}
                        />
                    </div>
                )}
            </Tooltip>
        </ErrorBoundary>
    );
}
