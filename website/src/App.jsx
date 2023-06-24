import React, { Component } from 'react'

import { CLEAR_LOG, LOG, EXAMPLE_ALIGNMENT_FILE, DEFAULT_ALIGNMENT_FILE_NAME, EXAMPLE_REF_FILE, DEFAULT_REF_FILE_NAME, DEFAULT_VALS_FILE, DEFAULT_VALS_MAPPING } from './constants'

import './App.css'

import loading from './assets/loading.png'

export class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			version: '',

			refFile: undefined,
			exampleRefFile: undefined,
			alignmentFile: undefined,
			exampleAlignmentFile: undefined,
			primerFile: undefined,
			refFileValid: true,
			alignmentFileValid: true,
			primerFileValid: true,

			primerOffset: 0,
			primerOffsetValid: true,
			primerOffsetDefault: 0,

			minBaseQuality: 0,
			minBaseQualityValid: true,
			minBaseQualityDefault: 0,

			minDepth: 0,
			minDepthValid: true,
			minDepthDefault: 0,

			minFreq: 0,
			minFreqValid: true,
			minFreqDefault: 0,

			ambigSymbol: 'N',
			ambigSymbolValid: true,
			ambigSymbolDefault: 'N',

			genPosCounts: false,
			genInsCounts: false,
			CLI: undefined,
			done: false,
			loading: false,
			inputChanged: false
		}
	}

	async componentDidMount() {
		this.setState({
			CLI: await new Aioli(["ViralConsensus/viral_consensus/0.0.1", "minimap2/2.22", "fastp/0.20.1"])
		}, () => {
			CLEAR_LOG()
			LOG("ViralConsensus Online Tool loaded.")
		})

		this.preventNumberInputScrolling();
		this.fetchExampleFiles();
		this.loadDefaultsAndVersion();
	}

	preventNumberInputScrolling = () => {
		const numberInputs = document.querySelectorAll('input[type=number]');
		for (const numberInput of numberInputs) {
			numberInput.addEventListener('wheel', function (e) {
				e.preventDefault();
			});
		}
	}

	fetchExampleFiles = async () => {
		const exampleRefFile = await (await fetch(EXAMPLE_REF_FILE)).text();
		// note: blob is used here because the example file is binary () and mount accepts blob as data value for mount() function
		const exampleAlignmentFile = await (await fetch(EXAMPLE_ALIGNMENT_FILE)).blob();

		this.setState({ exampleRefFile, exampleAlignmentFile })
	}

	loadDefaultsAndVersion = async () => {
		const defaultTextFile = await (await fetch(DEFAULT_VALS_FILE)).text();
		const defaultText = [...defaultTextFile.matchAll(/#define DEFAULT.*$/gm)].map((line) => line[0].split(' '));
		for (const defaultValue of defaultText) {
			if (DEFAULT_VALS_MAPPING[defaultValue[1]]) {
				if (isNaN(defaultValue[2])) {
					defaultValue[2] = defaultValue[2].replace(/"|'/g, '');
				} else {
					defaultValue[2] = Number(defaultValue[2]);
				}
				this.setState({ [DEFAULT_VALS_MAPPING[defaultValue[1]] + "Default"]: defaultValue[2], [DEFAULT_VALS_MAPPING[defaultValue[1]]]: defaultValue[2] })
			}
		}

		const version = 'v' + defaultTextFile.matchAll(/#define VERSION.*$/gm).next().value[0].split(' ')[2].replace(/"|'/g, '');
		this.setState({ version })
	}

	uploadAlignmentFile = (e) => {
		this.setState({ alignmentFile: e.target.files[0], inputChanged: true })
	}

	uploadRefFile = (e) => {
		this.setState({ refFile: e.target.files[0], inputChanged: true })
	}

	uploadPrimerFile = (e) => {
		this.setState({ primerFile: e.target.files[0], inputChanged: true })
	}

	setPrimerOffset = (e) => {
		let primerOffsetValid = true;

		this.setState({ primerOffset: e.target.value, primerOffsetValid, inputChanged: true })
	}

	setMinBaseQuality = (e) => {
		let minBaseQualityValid = true;

		if (e.target.value < 0) {
			minBaseQualityValid = false;
		}

		this.setState({ minBaseQuality: e.target.value, minBaseQualityValid, inputChanged: true })
	}

	setMinDepth = (e) => {
		let minDepthValid = true;

		if (e.target.value < 0) {
			minDepthValid = false;
		}

		this.setState({ minDepth: e.target.value, minDepthValid, inputChanged: true })
	}

	setMinFreq = (e) => {
		let minFreqValid = true;

		if (e.target.value < 0 || e.target.value > 1) {
			minFreqValid = false;
		}

		this.setState({ minFreq: e.target.value, minFreqValid, inputChanged: true })
	}

	setAmbigSymbol = (e) => {
		let ambigSymbolValid = true;

		if (e.target.value.length !== 1) {
			ambigSymbolValid = false;
		}

		this.setState({ ambigSymbol: e.target.value, ambigSymbolValid, inputChanged: true })
	}

	setGenPosCounts = (e) => {
		this.setState({ genPosCounts: e.target.checked, inputChanged: true })
	}

	setGenInsCounts = (e) => {
		this.setState({ genInsCounts: e.target.checked, inputChanged: true })
	}

	toggleLoadExampleData = () => {
		this.setState(prevState => {
			const refFile = prevState.refFile === 'EXAMPLE_DATA' ? document.getElementById('reference-file')?.files[0] : 'EXAMPLE_DATA';
			const alignmentFile = prevState.alignmentFile === 'EXAMPLE_DATA' ? document.getElementById('alignment-file')?.files[0] : 'EXAMPLE_DATA';
			return {
				refFile,
				alignmentFile,
				refFileValid: true,
				alignmentFileValid: true,
				inputChanged: prevState.refFile !== refFile || prevState.alignmentFile !== alignmentFile
			}
		})
	}

	validInput = () => {
		let valid = true;
		let refFileValid = true;
		let alignmentFileValid = true;
		// Note: Other input validation is done in the setters

		CLEAR_LOG()
		LOG("Validating input...")

		if (!this.state.refFile) {
			refFileValid = false;
		}

		if (!this.state.alignmentFile) {
			alignmentFileValid = false;
		}

		valid = refFileValid && alignmentFileValid && this.state.primerOffsetValid && this.state.minBaseQualityValid && this.state.minDepthValid && this.state.minFreqValid && this.state.ambigSymbolValid;

		this.setState({ refFileValid, alignmentFileValid })

		return valid;
	}

	runViralConsensus = async () => {
		if (!this.validInput()) {
			LOG("Invalid input. Please check your input and try again.")
			return;
		}

		const startTime = performance.now();
		LOG("Running ViralConsensus...")
		this.setState({ done: false, loading: true, inputChanged: false })

		const CLI = this.state.CLI;

		if (CLI === undefined) {
			setTimeout(() => {
				this.runViralConsensus();
			}, 2000)
			return;
		}

		// if uploaded fastq, need to run minimap2 first
		let uploadedFastq = this.state.alignmentFile !== 'EXAMPLE_DATA' &&
		(this.state.alignmentFile.name.endsWith('.fastq') ||
		this.state.alignmentFile.name.endsWith('.fq') ||
		this.state.alignmentFile.name.endsWith('.fastq.gz') ||
		this.state.alignmentFile.name.endsWith('.fq.gz'));

		let command = `viral_consensus -i ${uploadedFastq ? '-' : (this.state.alignmentFile?.name ?? DEFAULT_ALIGNMENT_FILE_NAME)} -r ${this.state.refFile?.name ?? DEFAULT_REF_FILE_NAME} -o consensus.fa`;

		// Delete old files
		// TODO: is there a better way to delete a file other than unlink?
		if (await CLI.ls('consensus.fa')) {
			await CLI.fs.unlink('consensus.fa');
		}

		if (await CLI.ls('positionCounts.tsv')) {
			await CLI.fs.unlink('positionCounts.tsv');
		}

		if (await CLI.ls('insertionCounts.tsv')) {
			await CLI.fs.unlink('insertionCounts.tsv');
		}

		// Create example reference fasta file
		LOG("Writing reference file...")
		if (this.state.refFile === 'EXAMPLE_DATA') {
			await CLI.mount({
				name: DEFAULT_REF_FILE_NAME,
				data: this.state.exampleRefFile
			})
		} else {
			await CLI.mount([this.state.refFile])
		}

		// Create example alignments
		LOG("Writing alignment file...")
		if (this.state.alignmentFile === 'EXAMPLE_DATA') {
			await CLI.mount([{
				name: DEFAULT_ALIGNMENT_FILE_NAME,
				data: this.state.exampleAlignmentFile
			}])
		} else if (this.state.alignmentFile.name.endsWith('.bam') ||
			this.state.alignmentFile.name.endsWith('.sam') ||
			this.state.alignmentFile.name.endsWith('.cram')) {
			// handle bam/sam/cram files, don't need to run minimap2 
			await CLI.mount([this.state.alignmentFile])
		} else if (uploadedFastq) {
			// handle fastq files, need to run minimap2 (already handled in the declaration of command)
			// TODO: doesn't work yet, minimap2 works but the pipe returns an error of [ERROR] unknown option in "viral_consensus"
			await CLI.mount([this.state.alignmentFile])
			console.log(await CLI.ls('./'));
			command = `minimap2 -t 1 -a -x sr ${this.state.refFile?.name ?? DEFAULT_REF_FILE_NAME} ${this.state.alignmentFile?.name ?? DEFAULT_ALIGNMENT_FILE_NAME} | ${command}`;
			console.log(command)
			console.log((await CLI.exec(command)));
			console.log(await CLI.ls('./'));
		} else {
			// handle other file types, assuming bam/sam/cram, but giving a warning
			LOG("WARNING: Alignment file extension not recognized. Assuming bam/sam/cram format.")
			await CLI.mount([this.state.alignmentFile])
		}

		// Create example primer file
		if (this.state.primerFile) {
			const fileReader = new FileReader();
			fileReader.onload = async () => {
				CLI.ls(this.state.primerFile.name) && await CLI.fs.unlink(this.state.primerFile.name);
				await CLI.fs.writeFile(this.state.primerFile.name, new Uint8Array(fileReader.result));
			}
			fileReader.readAsArrayBuffer(this.state.primerFile);
			command += ` -p ${this.state.primerFile.name} -po ${this.state.primerOffset}`;
		}

		// Set parameters
		command += ` -q ${this.state.minBaseQuality} -d ${this.state.minDepth} -f ${this.state.minFreq} -a ${this.state.ambigSymbol}`;

		// Set output files
		if (this.state.genPosCounts) {
			command += ' -op positionCounts.tsv';
		}

		if (this.state.genInsCounts) {
			command += ' -oi insertionCounts.tsv';
		}

		// Generate consensus genome
		LOG("Executing command: " + command)
		await CLI.exec(command);
		const consensusFile = await CLI.ls('consensus.fa');
		if (!consensusFile || consensusFile.size === 0) {
			LOG("Error: No consensus genome generated. Please check your input files.")
			this.setState({ loading: false })
			return;
		}

		this.setState({ done: true, loading: false })
		LOG(`Done! Time Elapsed: ${((performance.now() - startTime) / 1000).toFixed(3)} seconds`);
	}

	downloadConsensus = async () => {
		await this.downloadFile('consensus.fa');
		await this.downloadFile('positionCounts.tsv');
		await this.downloadFile('insertionCounts.tsv');
	}

	downloadFile = async (fileName) => {

		const CLI = this.state.CLI;
		if (!(await CLI.ls(fileName))) {
			return;
		}

		const fileBlob = await CLI.download(fileName);

		const element = document.createElement("a");
		element.href = fileBlob;
		element.download = fileName;
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);

		LOG(`Downloaded ${fileName}`)
	}

	render() {
		return (
			<div className="App pb-5">
				<h1 className="mt-4 mb-5 text-center">ViralConsensus {this.state.version}</h1>
				<div className="mt-3" id="container">
					<div id="input" className="ms-5 me-4">
						<h4 className="mb-3">Input</h4>
						<div className="d-flex flex-column mb-4">
							<label htmlFor="reference-file" className="form-label">Reference File (FASTA){this.state.refFile === 'EXAMPLE_DATA' && <span><strong>: Using example <a href={EXAMPLE_REF_FILE} target="_blank" rel="noreferrer">reference file</a>.</strong></span>}<span className="text-danger"> *</span></label>
							<input className={`form-control ${!this.state.refFileValid && 'is-invalid'}`} type="file" id="reference-file" onChange={this.uploadRefFile} />
						</div>

						<div className="d-flex flex-column mb-4">
							<label htmlFor="alignment-file" className="form-label">Input Reads File (BAM, SAM, CRAM, FASTQ){this.state.alignmentFile === 'EXAMPLE_DATA' && <span><strong>: Using example <a href={EXAMPLE_ALIGNMENT_FILE} target="_blank" rel="noreferrer">BAM file</a>.</strong></span>}<span className="text-danger"> *</span></label>
							<input className={`form-control ${!this.state.alignmentFileValid && 'is-invalid'}`} type="file" accept=".sam,.bam,.cram,.fastq,.fastq.gz,.fq,.fq.gz" id="alignment-file" onChange={this.uploadAlignmentFile} />
						</div>

						<button type="button" className={`btn btn-${(this.state.alignmentFile === 'EXAMPLE_DATA' || this.state.refFile === 'EXAMPLE_DATA') ? 'success' : 'warning'} mt-3`} onClick={this.toggleLoadExampleData}>
							Load Example Data Files {(this.state.alignmentFile === 'EXAMPLE_DATA' || this.state.refFile === 'EXAMPLE_DATA') && <strong>(Currently Using Example Files!)</strong>}
						</button>

						<div className="accordion accordion-flush my-5" id="optional-args">
							<div className="accordion-item">
								<h2 className="accordion-header">
									<button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#opt-args-collapse" aria-expanded="false" aria-controls="opt-args-collapse">
										Optional Arguments
									</button>
								</h2>
								<div id="opt-args-collapse" className="accordion-collapse collapse pt-4" data-bs-parent="#optional-args">
									<div className="d-flex flex-column mb-4">
										<label htmlFor="primer-file" className="form-label">Primer (BED) File</label>
										<input className="form-control" type="file" id="primer-file" onChange={this.uploadPrimerFile} />
									</div>

									<label htmlFor="min-base-quality" className="form-label">Primer Offset</label>
									<input id="primer-offset" className={`form-control ${!this.state.primerOffsetValid && 'is-invalid'}`} type="number" placeholder="Primer Offset" value={this.state.primerOffset} onChange={this.setPrimerOffset} />
									<div className="form-text mb-4">Number of bases after primer to also trim (default: {this.state.primerOffsetDefault})</div>

									<label htmlFor="min-base-quality" className="form-label">Minimum Base Quality</label>
									<input id="min-base-quality" className={`form-control ${!this.state.minBaseQualityValid && 'is-invalid'}`} type="number" placeholder="Minimum Base Quality" value={this.state.minBaseQuality} onChange={this.setMinBaseQuality} />
									<div className="form-text mb-4">Min. base quality to count base in counts (default: {this.state.minBaseQualityDefault})</div>

									<label htmlFor="min-depth" className="form-label">Minimum Depth</label>
									<input id="min-depth" className={`form-control ${!this.state.minDepthValid && 'is-invalid'}`} type="number" placeholder="Minimum Depth" value={this.state.minDepth} onChange={this.setMinDepth} />
									<div className="form-text mb-4">Min. depth to call base in consensus (default: {this.state.minDepthDefault})</div>

									<label htmlFor="min-freq" className="form-label">Minimum Frequency</label>
									<input id="min-freq" className={`form-control ${!this.state.minFreqValid && 'is-invalid'}`} type="number" placeholder="Minimum Frequency" value={this.state.minFreq} onChange={this.setMinFreq} />
									<div className="form-text mb-4">Min. frequency to call base/insertion in consensus (default: {this.state.minFreqDefault})</div>

									<label htmlFor="ambig-symbol" className="form-label">Ambiguous Symbol</label>
									<input id="ambig-symbol" className={`form-control ${!this.state.ambigSymbolValid && 'is-invalid'}`} type="text" placeholder="Ambiguous Symbol" value={this.state.ambigSymbol} onChange={this.setAmbigSymbol} />
									<div className="form-text mb-4">Symbol to use for ambiguous bases (default: {this.state.ambigSymbolDefault})</div>

									<div className="form-check">
										<label className="form-check-label" htmlFor="output-pos-counts">
											Generate Position Counts
										</label>
										<input className="form-check-input" type="checkbox" name="output-pos-counts" id="output-pos-counts" checked={this.state.genPosCounts} onChange={this.setGenPosCounts} />
									</div>
									<div className="form-check">
										<label className="form-check-label" htmlFor="output-ins-counts">
											Generate Insertion Counts
										</label>
										<input className="form-check-input" type="checkbox" name="output-ins-counts" id="output-ins-counts" checked={this.state.genInsCounts} onChange={this.setGenInsCounts} />
									</div>
								</div>
							</div>
						</div>
						<button type="button" className="btn btn-primary" onClick={this.runViralConsensus}>Submit</button>
					</div>
					<div id="output" className="form-group ms-4 me-5">
						<label htmlFor="output-text" className="mb-3"><h4>Console</h4></label>
						<textarea className="form-control" id="output-text" rows="3" disabled></textarea>
						{this.state.loading && <img id="loading" className="mt-3" src={loading} />}
						{this.state.done && <button type="button" className={`btn btn-primary mt-4`} onClick={this.downloadConsensus}>Download Output</button>}
						{this.state.done && this.state.inputChanged && <p className="text-danger text-center mt-4">Warning: Form input has changed since last run, run again to download latest output files.</p>}
					</div>
				</div>
				<footer className="text-center">
					Web-based implementation of <a href="https://www.github.com/niemasd/ViralConsensus" target="_blank" rel="noreferrer">ViralConsensus</a> using WebAssembly and <a href="https://biowasm.com/" target="_blank" rel="noreferrer">Biowasm</a>.<br />
					Special thank you to Robert Aboukhalil for his support.<br />
				</footer>
			</div>
		)
	}
}

export default App
