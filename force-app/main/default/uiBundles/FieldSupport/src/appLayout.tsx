import { AgentforceConversationClient } from "./components/AgentforceConversationClient";
import { Outlet, Link, useLocation } from "react-router";
import { getAllRoutes } from "./router-utils";
import { useEffect, useId, useRef, useState } from "react";

export default function AppLayout() {
	const [isOpen, setIsOpen] = useState(false);
	const location = useLocation();
	const navId = useId();
	const outletWrapperRef = useRef<HTMLDivElement>(null);
	const previousPathname = useRef<string | null>(null);

	useEffect(() => {
		if (previousPathname.current !== null && previousPathname.current !== location.pathname) {
			const wrapper = outletWrapperRef.current;
			const target = wrapper?.querySelector<HTMLElement>("h1, main, [role='main']") ?? wrapper;
			if (target) {
				if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
				target.focus();
			}
		}
		previousPathname.current = location.pathname;
	}, [location.pathname]);

	const isActive = (path: string) => location.pathname === path;

	const toggleMenu = () => setIsOpen(!isOpen);

	const navigationRoutes: { path: string; label: string }[] = getAllRoutes()
		.filter(
			(route) =>
				route.handle?.showInNavigation === true &&
				route.fullPath !== undefined &&
				route.handle?.label !== undefined,
		)
		.map(
			(route) =>
				({
					path: route.fullPath,
					label: route.handle?.label,
				}) as { path: string; label: string },
		);

	return (
		<>
			<a
				href="#main-content"
				onClick={(e) => {
					e.preventDefault();
					const content = outletWrapperRef.current;
					if (content) {
						if (!content.hasAttribute("tabindex")) content.setAttribute("tabindex", "-1");
						content.focus();
					}
				}}
				className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-gray-900 focus:shadow focus:ring-2 focus:ring-gray-900"
			>
				Skip to main content
			</a>
			<nav className="bg-white border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<Link to="/" className="text-xl font-semibold text-gray-900">
							Field Support PoC
						</Link>
						<button
							onClick={toggleMenu}
							className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
							aria-label="Toggle menu"
							aria-expanded={isOpen}
							aria-controls={navId}
						>
							<div aria-hidden="true" className="w-6 h-6 flex flex-col justify-center space-y-1.5">
								<span
									className={`block h-0.5 w-6 bg-current transition-all ${
										isOpen ? "rotate-45 translate-y-2" : ""
									}`}
								/>
								<span
									className={`block h-0.5 w-6 bg-current transition-all ${isOpen ? "opacity-0" : ""}`}
								/>
								<span
									className={`block h-0.5 w-6 bg-current transition-all ${
										isOpen ? "-rotate-45 -translate-y-2" : ""
									}`}
								/>
							</div>
						</button>
					</div>
					<div id={navId} className="pb-4" hidden={!isOpen}>
						{isOpen && (
							<div className="flex flex-col space-y-2">
								{navigationRoutes.map((item) => (
									<Link
										key={item.path}
										to={item.path}
										onClick={() => setIsOpen(false)}
										aria-current={isActive(item.path) ? "page" : undefined}
										className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
											isActive(item.path)
												? "bg-blue-100 text-blue-700"
												: "text-gray-700 hover:bg-gray-100"
										}`}
									>
										{item.label}
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
			</nav>
			<div id="main-content" ref={outletWrapperRef}>
				<Outlet />
			</div>
			<AgentforceConversationClient agentId="<USER_AGENT_ID_18_CHAR_0Xx...>" />
		</>
	);
}
