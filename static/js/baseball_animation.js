class BaseballAnimation {
    constructor(containerId, inputIds, buttonId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID ${containerId} not found`);
            return;
        }

        this.inputIds = inputIds;
        this.buttonId = buttonId;

        this.container.style.width = this.container.style.width || '400px';
        this.container.style.height = this.container.style.height || '400px';

        this.scene = new THREE.Scene();

        // Use OrthographicCamera for consistent thickness
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 10; // Adjust for zoom
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2, // left
            frustumSize * aspect / 2,  // right
            frustumSize / 2,           // top
            -frustumSize / 2,          // bottom
            0.1,                       // near
            1000                       // far
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0xffffff, 1);
        this.container.appendChild(this.renderer.domElement);

        this.textureLoader = new THREE.TextureLoader();
        const texturePromise = new Promise((resolve) => {
            this.baseballTexture = this.textureLoader.load(
                '/static/js/baseball_texture.jpg',
                (texture) => {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(1, 1);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('Texture loading failed:', error);
                    resolve(null);
                }
            );
        });

        this.geometry = new THREE.SphereGeometry(3, 32, 32);
        this.material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true
        });
        this.sphere = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.sphere);

        texturePromise.then((texture) => {
            if (texture) {
                this.material.map = texture;
                this.material.color.set(0xffffff);
                this.material.wireframe = false;
                this.material.needsUpdate = true;
                this.renderer.render(this.scene, this.camera);
            }
        });

        this.camera.position.z = 5;

        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.startingQuaternion = new THREE.Quaternion();

        this.spinRateX = 0;
        this.spinRateY = 0;
        this.spinRateZ = 0;
        this.isAnimating = false;

        this.line = null;
        this.spinAxis = new THREE.Vector3(0, 0, 1);

        this.initEventListeners();
    }

    updateStartingRotation() {
        this.startingQuaternion.copy(this.sphere.quaternion);
        const startingState = {
            quaternion: this.startingQuaternion.toArray()
        };
        sessionStorage.setItem(`startingRotation_${this.container.id}`, JSON.stringify(startingState));
    }

    getStartingRotation() {
        const savedState = JSON.parse(sessionStorage.getItem(`startingRotation_${this.container.id}`));
        if (savedState) {
            this.startingQuaternion.fromArray(savedState.quaternion);
            return this.startingQuaternion;
        }
        return new THREE.Quaternion();
    }

    initEventListeners() {
        if (!this.renderer) return;

        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);

        const classifyButton = document.getElementById(this.buttonId);
        if (classifyButton) {
            classifyButton.addEventListener('click', this.startAnimation.bind(this));
        } else {
            console.warn(`Classify button not found for ${this.buttonId}`);
        }
    }

    onMouseDown(event) {
        this.isDragging = true;
        this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }

    onMouseMove(event) {
        if (this.isDragging) {
            const deltaMove = {
                x: event.clientX - this.previousMousePosition.x,
                y: event.clientY - this.previousMousePosition.y
            };

            this.sphere.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -deltaMove.x * 0.005);
            this.sphere.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -deltaMove.y * 0.005);

            this.renderer.render(this.scene, this.camera);
        }
        this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }

    onMouseUp() {
        this.isDragging = false;
        this.updateStartingRotation();
    }

    createSpinAxisLine() {
        if (this.line) {
            this.scene.remove(this.line);
            this.line.geometry.dispose();
            this.line.material.dispose();
        }

        const length = 100; // Spans the scene
        const radius = 0.1; // Thickness (diameter = 0.2 units)
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
        this.line = new THREE.Mesh(geometry, material);

        // Align cylinder with spin axis
        const defaultAxis = new THREE.Vector3(0, 1, 0); // Cylinder's default Y-axis
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultAxis, this.spinAxis);
        this.line.quaternion.copy(quaternion);

        this.line.position.set(0, 0, 0); // Centered at origin

        this.scene.add(this.line);
    }

    startAnimation() {
        if (!this.sphere) return;

        const savedRotation = this.getStartingRotation();
        this.sphere.quaternion.copy(savedRotation);

        const spinRateXInput = document.getElementById(this.inputIds.x);
        const spinRateYInput = document.getElementById(this.inputIds.y);
        const spinRateZInput = document.getElementById(this.inputIds.z);
        const phiInput = document.getElementById(this.inputIds.phi);
        const thetaInput = document.getElementById(this.inputIds.theta);
        
        // Parse spin rates
        this.spinRateX = -parseFloat(spinRateXInput?.innerText) || 0;
        this.spinRateY = -parseFloat(spinRateYInput?.innerText) || 0;
        this.spinRateZ = -parseFloat(spinRateZInput?.innerText) || 0;

        // Convert Phi and Theta to radians
        const phi = phiInput ? parseFloat(phiInput.innerText) * (Math.PI / 180) : 0;
        const theta = thetaInput ? parseFloat(thetaInput.innerText) * (Math.PI / 180) : 0;

        // Convert spherical coordinates to Cartesian
        // Adjust the conversion to match the coordinate system in the paper
        this.spinAxis.set(
            Math.sin(theta) * Math.cos(phi),
            Math.sin(theta) * Math.sin(phi),
            Math.cos(theta)
        );

        // Normalize the spin axis
        this.spinAxis.normalize();

        this.createSpinAxisLine();

        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }

    animate() {
        if (!this.renderer || !this.scene || !this.camera) return;

        requestAnimationFrame(this.animate.bind(this));

        if (this.isAnimating) {
            // Calculate total rotation speed
            // Reduce spin speed further and ensure correct rotation direction
            const totalRotationSpeed = Math.sqrt(
                Math.pow(this.spinRateX, 2) + 
                Math.pow(this.spinRateY, 2) + 
                Math.pow(this.spinRateZ, 2)
            ) * (2 * Math.PI) / 600000; // Further reduced divisor

            // Rotate in the opposite direction to match physical spin
            this.sphere.rotateOnWorldAxis(this.spinAxis, -totalRotationSpeed);

            this.renderer.render(this.scene, this.camera);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const animations = [
        {
            containerId: 'target-animation-container',
            inputIds: {
                x: 'target_omega_x',
                y: 'target_omega_y',
                z: 'target_omega_z',
                phi: 'spin_axis_phi',
                theta: 'spin_axis_theta'
            },
            buttonId: 'show'
        }
    ];

    const baseballAnimations = animations.map(config => {
        try {
            const animation = new BaseballAnimation(
                config.containerId,
                config.inputIds,
                config.buttonId
            );
            if (animation.container && animation.renderer) {
                animation.startAnimation();
                return animation;
            }
            console.warn(`Skipping animation for ${config.containerId} due to initialization failure`);
            return null;
        } catch (error) {
            console.error(`Failed to initialize animation for ${config.containerId}:`, error);
            return null;
        }
    }).filter(anim => anim !== null);
});