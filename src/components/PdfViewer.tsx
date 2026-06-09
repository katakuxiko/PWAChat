import { Spin } from "antd";
import {
	useCallback,
	memo,
	useEffect,
	useMemo,
	useState,
	type ComponentType,
	type ReactNode,
} from "react";
import "react-pdf/dist/Page/TextLayer.css";

interface DocumentProps {
	file?: string | { url: string; httpHeaders?: Record<string, string> };
	onLoadSuccess?: (pdf: { numPages: number }) => void;
	onLoadError?: (error: Error) => void;
	loading?: ReactNode;
	error?: ReactNode;
	children?: ReactNode;
}

interface PageProps {
	pageNumber: number;
	width?: number;
	renderTextLayer?: boolean;
	renderAnnotationLayer?: boolean;
}

interface PdfComponents {
	Document: ComponentType<DocumentProps>;
	Page: ComponentType<PageProps>;
}

interface PdfViewerProps {
	url: string;
	token?: string;
	onUnauthorized?: () => void;
}

const DEFAULT_SCALE = 1;

const PdfViewerComponent = ({ url, token, onUnauthorized }: PdfViewerProps) => {
	const [pdfComponents, setPdfComponents] = useState<PdfComponents | null>(
		null,
	);
	const [numPages, setNumPages] = useState<number>(0);
	const [error, setError] = useState<string | null>(null);
	const [containerWidth, setContainerWidth] = useState<number>(0);
	const [scale, setScale] = useState<number>(DEFAULT_SCALE);
	const [containerElement, setContainerElement] =
		useState<HTMLDivElement | null>(null);

	const minScale = 0.2;
	const maxScale = 2;

	useEffect(() => {
		if (typeof window === "undefined") return;

		let isMounted = true;
		import("react-pdf")
			.then((pdfModule) => {
				if (!isMounted) return;
				const { Document, Page, pdfjs } = pdfModule;
				pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
				setPdfComponents({ Document, Page });
			})
			.catch((importError: unknown) => {
				console.error("Failed to load PDF libraries:", importError);
				if (!isMounted) return;
				setError("Не удалось загрузить библиотеку PDF");
			});

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!url) {
			setNumPages(0);
			setError(null);
			setScale(DEFAULT_SCALE);
			return;
		}

		setNumPages(0);
		setError(null);
		setScale(DEFAULT_SCALE);
	}, [url]);

	const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
		setContainerElement(node);
	}, []);

	useEffect(() => {
		if (!containerElement || typeof ResizeObserver === "undefined") return;

		const resizeObserver = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			setContainerWidth(width);
		});

		resizeObserver.observe(containerElement);
		setContainerWidth(containerElement.clientWidth || 0);

		return () => {
			resizeObserver.disconnect();
		};
	}, [containerElement]);

	useEffect(() => {
		const handleWheel = (event: WheelEvent) => {
			if (!(event.ctrlKey || event.metaKey)) return;
			event.preventDefault();
			event.stopPropagation();
			const factor = Math.exp(-event.deltaY * 0.0015);
			setScale((prev) => Math.max(minScale, Math.min(maxScale, prev * factor)));
		};

		window.addEventListener("wheel", handleWheel, {
			passive: false,
			capture: true,
		});

		return () => {
			window.removeEventListener("wheel", handleWheel, {
				capture: true,
			} as AddEventListenerOptions);
		};
	}, []);

	const file = useMemo(() => {
		const rawBaseUrl = import.meta.env.VITE_BASE_URL ?? "";
		const baseUrl = rawBaseUrl.endsWith("/")
			? rawBaseUrl.slice(0, -1)
			: rawBaseUrl;
		const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

		return {
			url: `${baseUrl}${normalizedUrl}`,
			httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
		};
	}, [url, token]);

	if (!pdfComponents) {
		return (
			<div className="h-full w-full flex items-center justify-center">
				<Spin />
			</div>
		);
	}

	const { Document, Page } = pdfComponents;

	return (
		<div className="h-full w-full">
			<Document
				file={file}
				onLoadSuccess={({ numPages: loadedPages }: { numPages: number }) => {
					setNumPages(loadedPages);
					setError(null);
				}}
				onLoadError={(loadError: unknown) => {
					const errorMessage =
						loadError instanceof Error
							? loadError.message
							: "Неизвестная ошибка";
					console.error("PDF load error:", loadError);
					setError(errorMessage);

					const normalizedMessage = errorMessage.toLowerCase();
					if (
						normalizedMessage.includes("401") ||
						normalizedMessage.includes("unauthorized")
					) {
						onUnauthorized?.();
					}
				}}
				loading={
					<div className="h-full w-full flex items-center justify-center pt-6">
						<Spin />
					</div>
				}
				error={
					<div className="h-full w-full flex items-center justify-center text-red-500 px-4 text-center">
						Ошибка загрузки PDF: {error || "Неизвестная ошибка"}
					</div>
				}
			>
				<div
					ref={handleContainerRef}
					className="w-full h-full border border-gray-200 rounded-lg overflow-auto bg-white"
				>
					<div
						style={{
							width:
								containerWidth > 0 ? containerWidth * scale - 24 : undefined,
						}}
					>
						<div
							style={{
								transform: `scale(${scale / 2})`,
								transformOrigin: "top left",
								width: containerWidth > 0 ? containerWidth : undefined,
								transition: "transform 0.15s ease-out",
							}}
						>
							{numPages > 0
								? Array.from(
										{ length: numPages },
										(_el, index) => index + 1,
									).map((pageNumber) => (
										<Page
											key={`page_${pageNumber}`}
											pageNumber={pageNumber}
											width={
												containerWidth > 0
													? Math.max(0, containerWidth * 2 - 24)
													: undefined
											}
											renderTextLayer={true}
											renderAnnotationLayer={false}
										/>
									))
								: null}
						</div>
					</div>
				</div>
			</Document>
		</div>
	);
};

export const PdfViewer = memo(PdfViewerComponent);

export default PdfViewer;
