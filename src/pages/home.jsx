import React, { useState } from "react";

export default function Home() {
	const [submitted, setSubmitted] = useState(false);

	function handleSubmit(event) {
		event.preventDefault();
		setSubmitted(true);
	}

	return (
		<main style={styles.page}>
			<section style={styles.card}>
				<h1 style={styles.title}>LogSync - Home</h1>
				<p style={styles.description}>View different log files and synchronize them across platforms.</p>

				{submitted ? (
					<p role="status" style={styles.success}></p>
				) : (
					<form onSubmit={handleSubmit} style={styles.form}>
						<label style={styles.label} htmlFor="name">Name</label>
						<input style={styles.input} id="name" name="name" type="text" placeholder="Your name" required />

						<label style={styles.label} htmlFor="email">Email</label>
						<input style={styles.input} id="email" name="email" type="email" placeholder="you@example.com" required />

						<label style={styles.label} htmlFor="message">Message</label>
						<textarea style={{ ...styles.input, ...styles.textarea }} id="message" name="message" rows="5" placeholder="How can we help?" required />

						<button style={styles.button} type="submit">Send message</button>
					</form>
				)}
			</section>
		</main>
	);
}

const styles = {
	page: {
		minHeight: "100vh",
		display: "grid",
		placeItems: "center",
		padding: "32px 16px",
		background: "#f4f6fb",
		fontFamily: "Arial, sans-serif",
	},
	card: {
		width: "100%",
		maxWidth: "460px",
		boxSizing: "border-box",
		padding: "32px",
		borderRadius: "12px",
		background: "#fff",
		boxShadow: "0 8px 28px rgba(20, 35, 70, 0.1)",
	},
	title: { margin: "0 0 8px", color: "#182238", fontSize: "28px" },
	description: { margin: "0 0 24px", color: "#647087", lineHeight: 1.5 },
	form: { display: "flex", flexDirection: "column", gap: "10px" },
	label: { color: "#28344b", fontSize: "14px", fontWeight: 600 },
	input: {
		boxSizing: "border-box",
		width: "100%",
		padding: "11px 12px",
		border: "1px solid #d5dbe6",
		borderRadius: "6px",
		font: "inherit",
		marginBottom: "8px",
	},
	textarea: { resize: "vertical" },
	button: {
		padding: "12px 16px",
		border: 0,
		borderRadius: "6px",
		background: "#315eea",
		color: "#fff",
		fontSize: "15px",
		fontWeight: 600,
		cursor: "pointer",
	},
	success: { padding: "14px", borderRadius: "6px", background: "#e9f8ef", color: "#176b37" },
};
