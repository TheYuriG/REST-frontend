import React, { Component } from 'react';

import Image from '../../../components/Image/Image';
import './SinglePost.css';
//? Import the server URL
import { server } from '../../../util/server.js';

class SinglePost extends Component {
	state = {
		title: '',
		author: '',
		date: '',
		image: '',
		content: '',
	};

	componentDidMount() {
		const postId = this.props.match.params.postId;
		const graphqlSinglePostQuery = {
			query: `
                {
                    singlePost(ID: "${postId}") {
                        _id
                        title
                        content
                        imageUrl
                        creator {
                            name
                        }
                        createdAt
                    }
                }`,
		};
		fetch(server + '/graphql', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(graphqlSinglePostQuery),
		})
			.then((res) => {
				return res.json();
			})
			.then((resData) => {
				//? Check specifically if the server returned an
				//? Unauthorized status code and throw that error
				if (resData.errors && resData.errors[0].status === 401) {
					throw new Error('Failed to fetch post, you are not authenticated!');
				}
				//? If not, check if we got any errors and if so, throw that
				if (resData.errors) {
					throw new Error('Unable to retrieve post!');
				}

				this.setState({
					title: resData.data.singlePost.title,
					author: resData.data.singlePost.creator.name,
					image: server + '/' + resData.data.singlePost.imageUrl,
					date: resData.data.singlePost.createdAt,
					content: resData.data.singlePost.content,
				});
				// console.log(server + resData.post.imageUrl);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	render() {
		return (
			<section className="single-post">
				<h1>{this.state.title}</h1>
				<h2>
					Created by {this.state.author} on {this.state.date}
				</h2>
				<div className="single-post__image">
					<Image contain imageUrl={this.state.image} />
				</div>
				<p>{this.state.content}</p>
			</section>
		);
	}
}

export default SinglePost;
